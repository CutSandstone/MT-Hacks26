import json, os, pathlib, sys, urllib.request

KEY = os.environ.get('ELEVENLABS_API_KEY')
if not KEY:
    sys.exit('Set ELEVENLABS_API_KEY to regenerate narration.')

VOICE = os.environ.get('ELEVENLABS_VOICE_ID', 'nPczCjzI2devNBz1zQrb')  # Brian (ElevenLabs built-in, English)
out = pathlib.Path(__file__).resolve().parent / 'beats'
for i in range(1, 8):
    text = (out / f'beat{i}.txt').read_text().strip()
    body = json.dumps({
        'text': text,
        'model_id': 'eleven_multilingual_v2',
        'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75},
        'output_format': 'mp3_44100_128',
    }).encode()
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}',
        data=body, method='POST',
        headers={'xi-api-key': KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    with urllib.request.urlopen(req, timeout=60) as r:
        (out / f'beat{i}.mp3').write_bytes(r.read())
    print('beat', i, 'done')
