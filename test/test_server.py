"""Regression tests for server.py — no live inference calls, no .env needed."""
import json
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402

CYBER_CONTEXT = {
    'title': 'Entering cybersecurity after a CS degree',
    'company': 'Palo Alto Networks', 'ticker': 'PANW',
    'fact': 'Its Cortex XSIAM product automates parts of security operations, and the company describes analysts using it for alert handling and investigations.',
    'caveat': 'Those facts also support a competing explanation: a team could adopt the tool and keep its junior analysts.',
    'scenarios': ['Employers automate some junior work and the vendor gains customers'],
}


def devin_gateway():
    """Select the Devin Gateway provider with deterministic config."""
    return mock.patch.multiple(
        server, PROVIDER='devin',
        GATEWAY_BASE_URL='http://127.0.0.1:3001', GATEWAY_MODEL='swe-2-high')


def snowflake_provider():
    """Select the Snowflake provider with deterministic config."""
    return mock.patch.multiple(
        server, PROVIDER='snowflake', ACCOUNT='acct', PAT='tok',
        WAREHOUSE='WH', SNOWFLAKE_MODEL='mistral-large3')


class _FakeResp:
    """Stand-in for the object urllib.request.urlopen returns."""

    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _capture_urlopen(payload):
    """Return (captured, fake) — fake records the request and yields payload."""
    captured = {}

    def fake(req, timeout=None):
        captured['url'] = req.full_url
        captured['headers'] = {k.lower(): v for k, v in req.header_items()}
        captured['body'] = json.loads(req.data)
        captured['timeout'] = timeout
        return _FakeResp(payload)

    return captured, fake


# ---------- pure-function tests ----------

class StatementTests(unittest.TestCase):
    """Snowflake SQL backend — explicitly selected, never dispatched live."""

    def test_prompt_is_bound_not_interpolated(self):
        prompt = "evil '; DROP TABLE x; -- \"quotes\""
        captured = {}

        def fake_execute(stmt, bindings):
            captured['stmt'] = stmt
            captured['bindings'] = bindings
            return '{}'

        with snowflake_provider(), mock.patch.object(
                server, 'execute_statement', side_effect=fake_execute):
            server.ai_complete(prompt, server.INTERPRET_SCHEMA)

        self.assertIn('prompt => ?', captured['stmt'])
        self.assertNotIn(prompt, captured['stmt'])
        self.assertEqual(captured['bindings'], {'1': {'type': 'TEXT', 'value': prompt}})

    def test_statement_carries_code_owned_schema(self):
        with snowflake_provider():
            stmt = server.build_statement(server.INTERPRET_SCHEMA)
        self.assertIn('response_format =>', stmt)
        self.assertIn("'type': 'json'", stmt)
        for cid in server.CASE_IDS:
            self.assertIn(sql_repr(cid), stmt)
        self.assertIn('temperature', stmt)

    def test_sql_object_escaping(self):
        lit = server.sql_object({'k': "o'neil", 'n': 3, 'b': True, 'l': [1, 'x']})
        self.assertEqual(lit, "{'k': 'o''neil', 'n': 3, 'b': TRUE, 'l': [1, 'x']}")


def sql_repr(s):
    return f"'{s}'"


def classification(route, **fields):
    return {'route': route, 'inputs': [
        {'field': key, 'value': value} for key, value in fields.items()]}


class InterpretTests(unittest.TestCase):
    def test_known_routes_with_explicit_values(self):
        for route, key in [('income', 'quantity'), ('expense', 'stressPrice'),
                           ('fx-bill', 'foreignDue'), ('cyber', 'extraMonths'),
                           ('yen', 'budgetRate'), ('car', 'mpg')]:
            with self.subTest(route=route):
                obj = classification(route, **{key: 20})
                self.assertEqual(server.validate_interpret(obj, '20 units'), {
                    'type': 'match', 'caseId': route, 'inputs': {key: 20}})

    def test_refusal_and_clarification(self):
        for route in ('unsupported', 'ambiguous'):
            self.assertEqual(server.validate_interpret(classification(route), 'anything'),
                             {'type': route})

    def test_input_grounding(self):
        text = 'If my bill goes from $1,250.50 to $1,500, it could take 3% of my income.'
        result = server.validate_interpret(classification(
            'expense', baselinePrice=1250.5, stressPrice=1500, quantity=3, position=1000), text)
        self.assertEqual(result['inputs'], {'baselinePrice': 1250.5, 'stressPrice': 1500})

    def test_invalid_completion(self):
        for obj in (None, [], {'route': 'car'}, classification('pick-an-investment'),
                    classification('car', foreignDue=20), classification('fx-bill', budgetRate=0),
                    classification('expense', position=True), classification('income', quantity=0),
                    classification('expense', stressPrice=float('nan')),
                    classification('expense', stressPrice=float('inf')),
                    classification('car', position=10**400),
                    {**classification('car'), 'ticker': 'PANW'}):
            with self.subTest(obj=obj), self.assertRaises(ValueError):
                server.validate_interpret(obj, '20')

    def test_json_must_be_one_object(self):
        for raw in ('explanation {"route":"car","inputs":[]}',
                    '{"route":"car","inputs":[]} trailing prose',
                    '```json\n{"route":"car","inputs":[]}\n```',
                    '[]', 'null', '', None):
            self.assertIsNone(server.parse_model_json(raw), raw)


class AskTests(unittest.TestCase):
    def test_resolve_known_contexts(self):
        self.assertEqual(server.resolve_public_context(CYBER_CONTEXT), 'cyber')
        self.assertEqual(server.resolve_public_context({'caseId': 'car'}), 'car')
        self.assertEqual(server.resolve_public_context({'ticker': 'tm'}), 'yen')
        self.assertEqual(server.resolve_public_context({'company': 'valero'}), 'car')

    def test_resolve_unknown_contexts(self):
        for bad in (None, {}, {'company': 'Enron'}, {'ticker': 'GME'}, 'cyber'):
            self.assertIsNone(server.resolve_public_context(bad), bad)

    def test_compose_fact_and_caveat(self):
        self.assertEqual(
            server.compose_ask_answer('cyber', {'selection': 'fact', 'scenarioIndex': -1}),
            server.PUBLIC_EXAMPLES['cyber']['fact'])
        self.assertEqual(
            server.compose_ask_answer('car', {'selection': 'caveat', 'scenarioIndex': 0}),
            server.PUBLIC_EXAMPLES['car']['caveat'])

    def test_compose_scenario(self):
        ans = server.compose_ask_answer('cyber', {'selection': 'scenarios', 'scenarioIndex': 1})
        self.assertIn('spending freeze', ans)
        self.assertIn('Assumed return: -20%', ans)

    def test_compose_all_scenarios(self):
        ans = server.compose_ask_answer('yen', {'selection': 'scenarios', 'scenarioIndex': -1})
        self.assertIn('Toyota shares fall', ans)
        self.assertIn('vehicle sales', ans)
        self.assertIn('hold until tuition is due', ans)

    def test_compose_fail_closed(self):
        scope = server.ASK_SCOPE_ANSWER
        for bad in ({'selection': 'freeform', 'scenarioIndex': 0},
                    {'selection': 'scenarios', 'scenarioIndex': 99},
                    {'selection': 'scenarios', 'scenarioIndex': '0'},
                    {'selection': 'scenarios', 'scenarioIndex': True},
                    {'selection': 'scenarios'},
                    {}, None, 'fact'):
            self.assertEqual(server.compose_ask_answer('cyber', bad), scope, bad)

    def test_ask_schema_is_finite(self):
        enum = server.ASK_SCHEMA['properties']['selection']['enum']
        self.assertEqual(set(enum), {'fact', 'caveat', 'scenarios', 'unsupported'})

    def test_ask_prompt_contains_fixture_and_question(self):
        p = server.build_ask_prompt('cyber', 'why this stock?')
        self.assertIn('Palo Alto Networks', p)
        self.assertIn('why this stock?', p)
        self.assertIn('unsupported', p)


# ---------- Devin Gateway provider ----------

class GatewayConfigTests(unittest.TestCase):
    def test_gateway_url_default(self):
        with devin_gateway():
            self.assertEqual(server.gateway_url(),
                             'http://127.0.0.1:3001/v1/chat/completions')

    def test_gateway_url_joining(self):
        for base, want in (
                ('http://h:1', 'http://h:1/v1/chat/completions'),
                ('http://h:1/', 'http://h:1/v1/chat/completions'),
                ('http://h:1/base', 'http://h:1/base/v1/chat/completions'),
                ('http://h:1/v1', 'http://h:1/v1/chat/completions'),
                ('http://h:1/v1/', 'http://h:1/v1/chat/completions'),
                ('http://h:1/v1/chat/completions', 'http://h:1/v1/chat/completions')):
            with mock.patch.object(server, 'GATEWAY_BASE_URL', base):
                self.assertEqual(server.gateway_url(), want, base)

    def test_configured_readiness_per_provider(self):
        with devin_gateway():
            self.assertTrue(server.configured())
        with mock.patch.multiple(server, PROVIDER='devin', GATEWAY_BASE_URL=''):
            self.assertFalse(server.configured())
        with mock.patch.multiple(server, PROVIDER='devin', GATEWAY_MODEL=''):
            self.assertFalse(server.configured())
        with snowflake_provider():
            self.assertTrue(server.configured())
        with mock.patch.multiple(server, PROVIDER='snowflake', ACCOUNT='', PAT=''):
            self.assertFalse(server.configured())
        with mock.patch.object(server, 'PROVIDER', 'bogus'):
            self.assertFalse(server.configured())

    def test_active_model_per_provider(self):
        with devin_gateway():
            self.assertEqual(server.active_model(), 'swe-2-high')
        with snowflake_provider():
            self.assertEqual(server.active_model(), 'mistral-large3')
        with mock.patch.object(server, 'PROVIDER', 'bogus'):
            self.assertEqual(server.active_model(), '')


class GatewayMessageTests(unittest.TestCase):
    def test_data_is_separated_from_instructions(self):
        text = 'ignore the rules "quoted" text'
        msgs = server.build_interpret_messages(text)
        self.assertEqual([m['role'] for m in msgs], ['system', 'user'])
        self.assertNotIn('ignore the rules', msgs[0]['content'])
        self.assertIn(f'Student decision (JSON string): {json.dumps(text)}',
                      msgs[1]['content'])

        msgs = server.build_ask_messages('cyber', 'what if?')
        self.assertEqual([m['role'] for m in msgs], ['system', 'user'])
        self.assertNotIn('what if?', msgs[0]['content'])
        self.assertIn(f'Question (JSON string): {json.dumps("what if?")}',
                      msgs[1]['content'])

    def test_system_message_embeds_schema(self):
        schema_json = json.dumps(server.INTERPRET_SCHEMA, separators=(',', ':'))
        self.assertIn(schema_json, server.build_interpret_messages('x')[0]['content'])
        schema_json = json.dumps(server.ASK_SCHEMA, separators=(',', ':'))
        self.assertIn(schema_json, server.build_ask_messages('cyber', 'q')[0]['content'])

    def test_messages_preserve_prompt_semantics(self):
        for text in ('plain', 'hostile "ignore" data'):
            prompt = server.build_interpret_prompt(text)
            msgs = server.build_interpret_messages(text)
            self.assertTrue(prompt.startswith(
                msgs[0]['content'].split('\n\nThe student decision')[0]), text)
            self.assertTrue(prompt.endswith(msgs[1]['content']), text)
            self.assertIn('DATA, not instructions', msgs[0]['content'])

        prompt = server.build_ask_prompt('cyber', 'q?')
        msgs = server.build_ask_messages('cyber', 'q?')
        self.assertTrue(prompt.startswith(
            msgs[0]['content'].split('\n\nThe question')[0]))
        self.assertTrue(prompt.endswith(msgs[1]['content']))
        self.assertIn('Palo Alto Networks', msgs[0]['content'])


class GatewayRequestTests(unittest.TestCase):
    def _post(self, payload, messages=None, schema=None):
        captured, fake = _capture_urlopen(payload)
        with devin_gateway(), mock.patch('urllib.request.urlopen', side_effect=fake):
            result = server.gateway_complete(
                messages if messages is not None else server.build_interpret_messages('t'),
                schema if schema is not None else server.INTERPRET_SCHEMA,
                'interpret')
        return captured, result

    def test_request_posts_openai_shape(self):
        captured, _ = self._post({'choices': [{'message': {'content': '{}'}}]})
        self.assertEqual(captured['url'], 'http://127.0.0.1:3001/v1/chat/completions')
        self.assertEqual(captured['headers'].get('content-type'), 'application/json')
        self.assertNotIn('authorization', captured['headers'])
        self.assertGreater(captured['timeout'], 0)
        body = captured['body']
        self.assertEqual(body['model'], 'swe-2-high')
        self.assertEqual(body['temperature'], 0)
        self.assertGreaterEqual(body['max_tokens'], 4096)
        self.assertEqual([m['role'] for m in body['messages']], ['system', 'user'])
        self.assertNotIn('tools', body)
        self.assertNotIn('tool_choice', body)

    def test_request_carries_structured_output(self):
        captured, _ = self._post({'choices': [{'message': {'content': '{}'}}]})
        fmt = captured['body']['response_format']
        self.assertEqual(fmt['type'], 'json_schema')
        self.assertTrue(fmt['json_schema']['strict'])
        self.assertEqual(fmt['json_schema']['name'], 'interpret')
        self.assertEqual(fmt['json_schema']['schema'], server.INTERPRET_SCHEMA)

    def test_request_uses_configured_model_and_url(self):
        captured, fake = _capture_urlopen({'choices': [{'message': {'content': '{}'}}]})
        with mock.patch.multiple(server, PROVIDER='devin',
                                 GATEWAY_BASE_URL='http://gw.local:9/x',
                                 GATEWAY_MODEL='other-model'), \
                mock.patch('urllib.request.urlopen', side_effect=fake):
            server.gateway_complete([{'role': 'user', 'content': 'hi'}], {}, 'n')
        self.assertEqual(captured['url'], 'http://gw.local:9/x/v1/chat/completions')
        self.assertEqual(captured['body']['model'], 'other-model')

    def test_response_content_returned_verbatim(self):
        content = '{"route":"car","inputs":[]}'
        _, result = self._post({'choices': [{'message': {'content': content}}]})
        self.assertEqual(result, content)

    def test_response_ignores_sibling_fields(self):
        payload = {'choices': [{'index': 0, 'finish_reason': 'stop',
                                'message': {'role': 'assistant', 'content': '{}',
                                            'reasoning_content': 'chain'}}]}
        _, result = self._post(payload)
        self.assertEqual(result, '{}')

    def test_malformed_responses_fail_closed(self):
        for payload in ('junk', {}, [], {'choices': []}, {'choices': 'x'},
                        {'choices': [{}]}, {'choices': [None]},
                        {'choices': [{'message': {}}]},
                        {'choices': [{'message': None}]},
                        {'choices': [{'message': {'content': 7}}]},
                        {'choices': [{'message': {'content': ['part']}}]}):
            with self.subTest(payload=payload), devin_gateway(), \
                    mock.patch('urllib.request.urlopen',
                               side_effect=lambda req, timeout=None: _FakeResp(payload)):
                with self.assertRaises(ValueError):
                    server.gateway_complete([], {}, 'n')

    def test_transport_errors_propagate(self):
        errors = (urllib.error.URLError('refused'),
                  urllib.error.HTTPError('u', 500, 'err', {}, None),
                  TimeoutError('slow'))
        for err in errors:
            with self.subTest(err=err), devin_gateway(), \
                    mock.patch('urllib.request.urlopen', side_effect=err):
                with self.assertRaises(type(err)):
                    server.gateway_complete([], {}, 'n')


class ProviderDispatchTests(unittest.TestCase):
    def test_interpret_uses_gateway_under_devin(self):
        with devin_gateway(), \
                mock.patch.object(server, 'gateway_complete', return_value='{}') as g, \
                mock.patch.object(server, 'ai_complete') as a:
            server.infer_interpret('buy a car')
        g.assert_called_once()
        a.assert_not_called()
        messages, schema, name = g.call_args[0]
        self.assertIs(schema, server.INTERPRET_SCHEMA)
        self.assertEqual(name, 'interpret')
        self.assertIn('buy a car', messages[1]['content'])

    def test_interpret_uses_snowflake_when_selected(self):
        with snowflake_provider(), \
                mock.patch.object(server, 'ai_complete', return_value='{}') as a, \
                mock.patch.object(server, 'gateway_complete') as g:
            server.infer_interpret('buy a car')
        a.assert_called_once()
        g.assert_not_called()
        prompt, schema = a.call_args[0]
        self.assertIs(schema, server.INTERPRET_SCHEMA)
        self.assertIn('buy a car', prompt)

    def test_ask_uses_gateway_under_devin(self):
        with devin_gateway(), \
                mock.patch.object(server, 'gateway_complete', return_value='{}') as g, \
                mock.patch.object(server, 'ai_complete') as a:
            server.infer_ask('cyber', 'why this stock?')
        a.assert_not_called()
        messages, schema, name = g.call_args[0]
        self.assertIs(schema, server.ASK_SCHEMA)
        self.assertEqual(name, 'ask')
        self.assertIn('why this stock?', messages[1]['content'])

    def test_ask_uses_snowflake_when_selected(self):
        with snowflake_provider(), \
                mock.patch.object(server, 'ai_complete', return_value='{}') as a, \
                mock.patch.object(server, 'gateway_complete') as g:
            server.infer_ask('cyber', 'why this stock?')
        g.assert_not_called()
        prompt, schema = a.call_args[0]
        self.assertIs(schema, server.ASK_SCHEMA)
        self.assertIn('why this stock?', prompt)

    def test_unknown_provider_fails_closed_without_fallback(self):
        with mock.patch.object(server, 'PROVIDER', 'bogus'), \
                mock.patch.object(server, 'ai_complete') as a, \
                mock.patch.object(server, 'gateway_complete') as g:
            self.assertFalse(server.configured())
            with self.assertRaises(RuntimeError):
                server.infer_interpret('x')
            with self.assertRaises(RuntimeError):
                server.infer_ask('cyber', 'q')
        a.assert_not_called()
        g.assert_not_called()


# ---------- HTTP tests (in-process server, mocked inference) ----------

def _post(url, payload, raw=None):
    data = raw if raw is not None else json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data, method='POST', headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def url(self, p):
        return f'http://127.0.0.1:{self.port}{p}'

    def test_status_devin(self):
        with devin_gateway():
            code, body = self._get('/api/status')
        self.assertEqual(code, 200)
        self.assertEqual(body, {'provider': 'devin', 'configured': True,
                                'model': 'swe-2-high', 'snowflake': False})

    def test_status_snowflake(self):
        with snowflake_provider():
            code, body = self._get('/api/status')
        self.assertEqual(code, 200)
        self.assertEqual(body, {'provider': 'snowflake', 'configured': True,
                                'model': 'mistral-large3', 'snowflake': True})

    def test_status_unconfigured(self):
        with mock.patch.multiple(server, PROVIDER='snowflake', ACCOUNT='', PAT=''):
            _, body = self._get('/api/status')
        self.assertEqual(body, {'provider': 'snowflake', 'configured': False,
                                'model': 'mistral-large3', 'snowflake': False})
        with mock.patch.multiple(server, PROVIDER='devin', GATEWAY_BASE_URL=''):
            _, body = self._get('/api/status')
        self.assertEqual(body, {'provider': 'devin', 'configured': False,
                                'model': 'swe-2-high', 'snowflake': False})
        with mock.patch.object(server, 'PROVIDER', 'bogus'):
            _, body = self._get('/api/status')
        self.assertEqual(body, {'provider': 'bogus', 'configured': False,
                                'model': '', 'snowflake': False})

    def test_env_and_dotfiles_not_served(self):
        for path in ('/.env', '/.git/config', '/.env.example', '/.gitignore'):
            try:
                urllib.request.urlopen(self.url(path), timeout=10)
                self.fail(f'{path} was served')
            except urllib.error.HTTPError as e:
                self.assertEqual(e.code, 404, path)

    def test_index_served(self):
        with urllib.request.urlopen(self.url('/index.html'), timeout=10) as r:
            self.assertEqual(r.status, 200)
            self.assertIn(b'<', r.read(200))

    def test_interpret_requires_config(self):
        for patch in (mock.patch.multiple(server, PROVIDER='snowflake',
                                          ACCOUNT='', PAT=''),
                      mock.patch.multiple(server, PROVIDER='devin',
                                          GATEWAY_BASE_URL=''),
                      mock.patch.object(server, 'PROVIDER', 'bogus')):
            with patch:
                code, _ = _post(self.url('/api/interpret'), {'text': 'hi'})
            self.assertEqual(code, 503)

    # ----- snowflake provider path (explicitly selected) -----

    def test_interpret_match(self):
        raw = json.dumps(classification('expense', quantity=1, baselinePrice=900,
                                        stressPrice=1200, position=1000))
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', return_value=raw) as m:
            code, body = _post(self.url('/api/interpret'), {'text': 'my $900 rent may rise to $1200'})
        self.assertEqual(code, 200)
        self.assertEqual(body, {'type': 'match', 'caseId': 'expense',
                                'inputs': {'baselinePrice': 900, 'stressPrice': 1200}})
        prompt, schema = m.call_args[0]
        self.assertIs(schema, server.INTERPRET_SCHEMA)
        self.assertIn('my $900 rent may rise to $1200', prompt)

    def test_interpret_model_garbage_fails_closed(self):
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', return_value='???'):
            code, body = _post(self.url('/api/interpret'), {'text': 'buy a car'})
        self.assertEqual(code, 502)

    def test_interpret_bad_match_fails_closed(self):
        raw = json.dumps({'type': 'match', 'caseId': 'tesla', 'inputs': {}})
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', return_value=raw):
            code, body = _post(self.url('/api/interpret'), {'text': 'buy a car'})
        self.assertEqual(code, 502)

    def test_interpret_response_never_echoes_raw(self):
        leak = 'MODEL-SAID-SECRET'
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', return_value=leak):
            code, body = _post(self.url('/api/interpret'), {'text': 'anything'})
        self.assertNotIn(leak, json.dumps(body))

    def test_interpret_empty_and_bad_bodies(self):
        with snowflake_provider():
            code, _ = _post(self.url('/api/interpret'), {'text': '  '})
            self.assertEqual(code, 400)
            code, _ = _post(self.url('/api/interpret'), None, raw=b'not json')
            self.assertEqual(code, 400)
            code, _ = _post(self.url('/api/interpret'), None, raw=b'[1,2]')
            self.assertEqual(code, 400)

    def test_oversize_decision_rejected_before_inference(self):
        with snowflake_provider(), \
                mock.patch.object(server, 'ai_complete') as model, \
                mock.patch.object(server, 'gateway_complete') as gw:
            code, _ = _post(self.url('/api/interpret'),
                            {'text': 'x' * (server.MAX_TEXT_CHARS + 1)})
        self.assertEqual(code, 400)
        model.assert_not_called()
        gw.assert_not_called()

    def test_ask_fact(self):
        raw = json.dumps({'selection': 'fact', 'scenarioIndex': -1})
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', return_value=raw):
            code, body = _post(self.url('/api/ask'),
                               {'context': CYBER_CONTEXT, 'question': 'why this company?'})
        self.assertEqual(code, 200)
        self.assertEqual(body['answer'], server.PUBLIC_EXAMPLES['cyber']['fact'])

    def test_ask_scenario(self):
        raw = json.dumps({'selection': 'scenarios', 'scenarioIndex': 0})
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', return_value=raw):
            _, body = _post(self.url('/api/ask'),
                            {'context': CYBER_CONTEXT, 'question': 'first scenario?'})
        self.assertIn('automate', body['answer'])

    def test_ask_unsupported_and_garbage(self):
        for raw in (json.dumps({'selection': 'unsupported', 'scenarioIndex': -1}), 'junk'):
            with snowflake_provider(), mock.patch.object(
                    server, 'ai_complete', return_value=raw):
                _, body = _post(self.url('/api/ask'),
                                {'context': CYBER_CONTEXT, 'question': 'what should I buy?'})
            self.assertEqual(body['answer'], server.ASK_SCOPE_ANSWER)

    def test_ask_unknown_context_never_calls_model(self):
        with snowflake_provider(), \
                mock.patch.object(server, 'ai_complete') as m, \
                mock.patch.object(server, 'gateway_complete') as g:
            _, body = _post(self.url('/api/ask'),
                            {'context': {'company': 'MadeUp Corp'}, 'question': 'hi'})
        self.assertEqual(body['answer'], server.ASK_SCOPE_ANSWER)
        m.assert_not_called()
        g.assert_not_called()

    def test_ask_uses_schema(self):
        raw = json.dumps({'selection': 'caveat', 'scenarioIndex': -1})
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', return_value=raw) as m:
            _post(self.url('/api/ask'), {'context': CYBER_CONTEXT, 'question': 'what could go wrong?'})
        _, schema = m.call_args[0]
        self.assertIs(schema, server.ASK_SCHEMA)

    def test_ask_empty_question(self):
        with snowflake_provider():
            code, _ = _post(self.url('/api/ask'), {'context': CYBER_CONTEXT, 'question': ''})
            self.assertEqual(code, 400)

    def test_error_is_generic(self):
        with snowflake_provider(), mock.patch.object(
                server, 'ai_complete', side_effect=Exception('INTERNAL-SECRET-DETAIL')):
            code, body = _post(self.url('/api/interpret'), {'text': 'car'})
        self.assertEqual(code, 502)
        self.assertNotIn('INTERNAL-SECRET-DETAIL', json.dumps(body))
        self.assertEqual(body, {'error': 'inference request failed'})

    # ----- devin gateway provider path (default) -----

    def test_interpret_match_via_gateway(self):
        raw = json.dumps(classification('expense', quantity=1, baselinePrice=900,
                                        stressPrice=1200))
        with devin_gateway(), mock.patch.object(
                server, 'gateway_complete', return_value=raw) as m:
            code, body = _post(self.url('/api/interpret'),
                               {'text': 'my $900 rent may rise to $1200'})
        self.assertEqual(code, 200)
        self.assertEqual(body['type'], 'match')
        self.assertEqual(body['caseId'], 'expense')
        messages, schema, name = m.call_args[0]
        self.assertIs(schema, server.INTERPRET_SCHEMA)
        self.assertEqual(name, 'interpret')
        self.assertIn('my $900 rent may rise to $1200', messages[1]['content'])

    def test_interpret_gateway_non_json_fails_closed(self):
        for raw in ('???', '{"route":"car","inputs":[]} plus prose',
                    '```json\n{"route":"car","inputs":[]}\n```',
                    '{"route":"car","inputs":[]} {"extra":1}'):
            with devin_gateway(), mock.patch.object(
                    server, 'gateway_complete', return_value=raw):
                code, _ = _post(self.url('/api/interpret'), {'text': 'buy a car'})
            self.assertEqual(code, 502, raw)

    def test_interpret_gateway_error_is_generic(self):
        with devin_gateway(), mock.patch.object(
                server, 'gateway_complete',
                side_effect=urllib.error.URLError('GATEWAY-INTERNAL-DETAIL')):
            code, body = _post(self.url('/api/interpret'), {'text': 'car'})
        self.assertEqual(code, 502)
        self.assertNotIn('GATEWAY-INTERNAL-DETAIL', json.dumps(body))
        self.assertEqual(body, {'error': 'inference request failed'})

    def test_interpret_response_never_echoes_gateway_raw(self):
        leak = 'GATEWAY-SAID-SECRET'
        with devin_gateway(), mock.patch.object(
                server, 'gateway_complete', return_value=leak):
            _, body = _post(self.url('/api/interpret'), {'text': 'anything'})
        self.assertNotIn(leak, json.dumps(body))

    def test_ask_via_gateway(self):
        raw = json.dumps({'selection': 'caveat', 'scenarioIndex': -1})
        with devin_gateway(), mock.patch.object(
                server, 'gateway_complete', return_value=raw) as m:
            code, body = _post(self.url('/api/ask'),
                               {'context': CYBER_CONTEXT, 'question': 'risk?'})
        self.assertEqual(code, 200)
        self.assertEqual(body['answer'], server.PUBLIC_EXAMPLES['cyber']['caveat'])
        messages, schema, name = m.call_args[0]
        self.assertIs(schema, server.ASK_SCHEMA)
        self.assertEqual(name, 'ask')
        self.assertIn('risk?', messages[1]['content'])

    def test_ask_gateway_garbage_returns_scope(self):
        with devin_gateway(), mock.patch.object(
                server, 'gateway_complete', return_value='not json'):
            _, body = _post(self.url('/api/ask'),
                            {'context': CYBER_CONTEXT, 'question': 'anything'})
        self.assertEqual(body['answer'], server.ASK_SCOPE_ANSWER)

    def test_unknown_endpoint(self):
        with snowflake_provider():
            code, _ = _post(self.url('/api/nope'), {})
            self.assertEqual(code, 404)

    def _get(self, path):
        try:
            with urllib.request.urlopen(self.url(path), timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


if __name__ == '__main__':
    unittest.main()
