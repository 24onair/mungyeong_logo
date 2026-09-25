# 문경패러글라이딩 — 쇼츠 엔드 모션 릴 (4.5s)

쇼츠 마지막에 붙이는 1080×1920 / 60fps / 4.5초 브랜드 쇼릴입니다.

| 파일 | 설명 |
|---|---|
| `out/mungyeong_reel.mp4` | 완성본 (효과음 포함, H.264 + AAC) |
| `out/mungyeong_reel_silent.mp4` | 무음 버전 (BGM 위에 얹을 때) |
| `out/sfx.wav` | 효과음 트랙만 따로 (48kHz 스테레오) |
| `out/poster.png` | 마지막 프레임 (썸네일/정지 화면용) |

## 타임라인 (150 BPM, 한 박 = 0.4초)

| 시간 | 장면 |
|---|---|
| 0.0 – 0.5 | 브랜드 블루 배경, 방사형 속도선, 빨간 슬래시, 흰 날개가 화면을 가르며 등장 → 사선 스트라이프로 하늘 화면 전환 |
| 0.4 – 0.8 | 거대한 **"문경"**이 카메라 앞에서 떨어져 **0.8초에 슬램**: 화면 흔들림, 플래시, 충격파, 파편 |
| 1.0 – 1.7 | "문경"이 로고 위치로 이동하고 **패·러·글·라·이·딩**이 16분음표 간격으로 튀어오름 |
| 1.4 – 2.1 | 패러글라이더 날개가 비행운을 남기며 크게 선회해 로고 위에 착지, 산줄이 그려지고 광택이 지나감 |
| 2.0 – 3.2 | 네이비 슬랩이 올라오고 **예약문의** 태그가 튀어나옴. **1688-6707**이 슬롯머신처럼 굴러와 멈춘 뒤 밑줄 스와이프 |
| 3.2 – 4.5 | 전화 아이콘 벨 울림, 번호 광택, 천천히 푸시인하며 홀드 |

## 다시 만들기

```bash
pip install pillow numpy scipy potracer imageio-ffmpeg
npm install
python3 src/vectorize_logo.py      # assets/logo_original.png -> src/logo_paths.js (로고 벡터화)
python3 src/make_audio.py          # out/sfx.wav
node src/render.mjs                # out/mungyeong_reel_silent.mp4 (headless Chromium, 6-샘플 모션블러)
ffmpeg -i out/mungyeong_reel_silent.mp4 -i out/sfx.wav -c:v copy -c:a aac -b:a 256k -shortest out/mungyeong_reel.mp4
```

`src/reel.html`을 브라우저로 열면 실시간 미리보기가 반복 재생됩니다.
모든 모션은 시간 `t`의 순수 함수(`src/reel.js`)라서 미리보기와 렌더 결과가 프레임 단위로 같습니다.

폰트: Black Han Sans, Noto Sans KR (둘 다 SIL OFL). 전화 아이콘: Material Icons (Apache 2.0).

---

# 버전 2 — 페이퍼 콜라주 릴 (Vox 스타일, 4.5s)

찢은 종이 배경 + 실제 사진 컷아웃 + 마커 낙서로 만든 페이퍼크래프트 콜라주 버전입니다.
1080×1920 / 30fps. 종이 조각은 스톱모션처럼 15fps 스텝으로 움직이고 12fps로 미세하게 흔들립니다(boil).

| 파일 | 설명 |
|---|---|
| `out/collage/mungyeong_collage.mp4` | 완성본 (마림바 그루브 + 종이 효과음) |
| `out/collage/mungyeong_collage_silent.mp4` | 무음 버전 |
| `out/collage/sfx.wav` | 사운드 트랙 |
| `out/collage/poster.png` | 마지막 프레임 |

| 시간 | 장면 |
|---|---|
| 0.0 – 0.7 | 하늘 띠·해·구름·산·언덕이 찢은 종이로 착착 쌓임 |
| 0.45 – 1.4 | 탠덤 사진 인화지가 철썩 붙고 테이프, 노란 마커 동그라미 + "짜릿!" |
| 1.2 – 1.9 | 크루 사진 스티커가 튀어오르고 빨간 화살표 + "이륙!" |
| 2.0 – 3.1 | 로고 카드가 떨어지고 글자 스티커가 하나씩, 종이 날개 착지 |
| 2.9 – 3.9 | 빨간 종이띠가 찢어지며 등장, **예약문의** 라벨, **1688-6707** 숫자 타일, 흰 마커 밑줄 |

```bash
pip install rembg onnxruntime            # 크루 사진 누끼 (isnet-general-use) -> assets/photos/launch_crew_cutout.png
python3 src/collage/make_paper.py       # 찢은 종이 스프라이트 -> assets/collage/, src/collage/sprites.js
python3 src/collage/make_audio.py       # out/collage/sfx.wav
node src/render.mjs --page src/collage/collage.html --out out/collage/mungyeong_collage_silent.mp4
```

손글씨 폰트: Nanum Pen Script (SIL OFL).
