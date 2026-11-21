#!/usr/bin/env python3
"""Rebuild What Would Hedge This - Demo.mp4 + Captions.srt from bundled sources.

Exact recipe used to produce the submitted video. No credentials needed:
uses the recorded take raw/demo.webm, raw/markers.json, rendered narration
beats/*.mp3, and the slide card HTML in slides/ (re-screenshotted via shots.cjs
if PNGs are absent — requires `npm install` for playwright, or place your own
slide{1a,1b,6,7}.png into slides/).

Outputs: out/final.mp4, out/captions.srt  (1920x1080 H264 + AAC, ~106.1s yen-only cut)
"""
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
RAW = ROOT / 'raw' / 'demo.webm'
MARKERS = ROOT / 'raw' / 'markers.json'
SLIDES = ROOT / 'slides'
BEATS = ROOT / 'beats'
OUT = ROOT / 'out'
OUT.mkdir(exist_ok=True)

# --- exact scene timing used in the submitted cut ---
SLIDE_DUR = {'slide1a': 13.5, 'slide1b': 8.37, 'slide6': 23.12, 'slide7': 19.78}
# beat segment target lengths = narration length + 0.55s breathing room
SEG_D = {'seg4': 17.036, 'seg5': 24.281}
# full take also contains the career segments at markers beat2-beat4
# marker names bounding each app segment inside the take
SEG_MARKS = {'seg4': ('beat4', 'beat5'), 'seg5': ('beat5', 'end')}
# career walkthrough (beats 2/3) was cut from the shipped demo; keep only beats
# 1, 4, 5, 6, 7 (~106 s yen-only cut)
KEEP_BEATS = (1, 4, 5, 6, 7)
# seg4 must open on the home screen with the cursor already over the yen entry,
# not on the tail of the career result: start 2.58 s after the beat4 marker
# (== 40.60 s in the bundled take) and conform 15.722 s to the 17.036 s slot
SEG4_LEAD_SKIP = 2.58
SEG5_TAIL = 0.4          # seconds kept after the 'end' marker
AUDIO_LEAD = 0.2         # silence before beat 1 narration
AUDIO_TAIL = 0.55        # clip length minus narration length
FPS = 30

def run(cmd):
    print('+', ' '.join(str(c) for c in cmd))
    subprocess.run(cmd, check=True)

def shots():
    if all((SLIDES / f'{n}.png').exists() for n in SLIDE_DUR):
        return
    run(['node', str(ROOT / 'shots.cjs')])

def slide_clips():
    for n, d in SLIDE_DUR.items():
        frames = int(d * FPS) + 1
        run(['ffmpeg', '-y', '-v', 'error', '-loop', '1', '-i', str(SLIDES / f'{n}.png'),
             '-filter_complex',
             f"[0:v]zoompan=z='min(1+0.055*on/{frames},1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={FPS},format=yuv420p",
             '-t', str(d), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
             '-r', str(FPS), str(OUT / f'clips_{n}.mp4')])

def app_clips():
    m = json.loads(MARKERS.read_text())
    for name, D in SEG_D.items():
        a, b = (m[SEG_MARKS[name][0]], m[SEG_MARKS[name][1]])
        if name == 'seg4':
            a += SEG4_LEAD_SKIP   # skip career-result tail; start on home screen
        if name == 'seg5':
            b += SEG5_TAIL
        L = b - a
        f = D / L
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(a), '-i', str(RAW),
             '-vf', f'trim=duration={L},setpts=(PTS-STARTPTS)*{f},fps={FPS},format=yuv420p',
             '-t', str(D),
             '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
             '-r', str(FPS), str(OUT / f'clips_{name}.mp4')])
        print(name, f'L={L:.2f} D={D:.2f} factor={f:.3f}')

def audio():
    for i in KEEP_BEATS:
        d = BEAT_D[i - 1]
        lead = AUDIO_LEAD if i == 1 else 0.0
        run(['ffmpeg', '-y', '-v', 'error', '-i', str(BEATS / f'beat{i}.mp3'),
             '-af', f'adelay={int(lead*1000)}|{int(lead*1000)},apad=whole_dur={d}',
             '-t', str(d), '-ar', '44100', '-ac', '2', str(OUT / f'audio_{i}.wav')])

def concat_and_mux():
    parts = ['clips_slide1a.mp4', 'clips_slide1b.mp4', 'clips_seg4.mp4',
             'clips_seg5.mp4', 'clips_slide6.mp4', 'clips_slide7.mp4']
    (OUT / 'vlist.txt').write_text(''.join(f"file '{p}'\n" for p in parts))
    (OUT / 'alist.txt').write_text(''.join(f"file 'audio_{i}.wav'\n" for i in KEEP_BEATS))
    run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0',
         '-i', str(OUT / 'vlist.txt'), '-c', 'copy', str(OUT / 'video_all.mp4')])
    run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0',
         '-i', str(OUT / 'alist.txt'), '-c', 'copy', str(OUT / 'audio_all.wav')])
    run(['ffmpeg', '-y', '-v', 'error', '-i', str(OUT / 'video_all.mp4'),
         '-i', str(OUT / 'audio_all.wav'), '-map', '0:v', '-map', '1:a',
         '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
         '-movflags', '+faststart', '-shortest', str(OUT / 'final.mp4')])

def srt():
    def ts(t):
        h = int(t // 3600); m = int(t // 60) % 60; s = t % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}".replace('.', ',')
    lines = []; idx = 1; off = AUDIO_LEAD
    for i in KEEP_BEATS:
        d = BEAT_D[i - 1]
        text = (BEATS / f'beat{i}.txt').read_text().strip()
        words = text.split()
        chunks = []; cur = []
        for w in words:
            cur.append(w)
            if len(cur) >= 8 and cur[-1].rstrip('”"').endswith(('.', '?', '!', ':')):
                chunks.append(' '.join(cur)); cur = []
        if cur:
            chunks.append(' '.join(cur))
        narr = d - AUDIO_TAIL
        t = off + (AUDIO_LEAD if i == 1 else 0.0)
        total = len(words)
        for c in chunks:
            n = len(c.split()); dur = narr * n / total
            lines.append(f"{idx}\n{ts(t)} --> {ts(t+dur)}\n{c}\n")
            idx += 1; t += dur
        off += d
    (OUT / 'captions.srt').write_text('\n'.join(lines))

# beat lengths (slide1a+slide1b combined cover beat 1)
BEAT_D = [SLIDE_DUR['slide1a'] + SLIDE_DUR['slide1b'],
          20.426, 21.587, SEG_D['seg4'], SEG_D['seg5'],
          SLIDE_DUR['slide6'], SLIDE_DUR['slide7']]

if __name__ == '__main__':
    shots()
    slide_clips()
    app_clips()
    audio()
    concat_and_mux()
    srt()
    print('done ->', OUT / 'final.mp4')
