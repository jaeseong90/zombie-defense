# 🧟 Dead Corridor — 2P Co-op Defense

모바일 가로 모드 트윈스틱 슈터. 두 명이 등 맞대고 좀비 15웨이브를 막아내세요.

## 플레이 방법

1. 가로 모드 폰 2대 (또는 PC 브라우저 탭 2개)
2. 한 명이 **방 만들기** → 6자리 코드 공유
3. 다른 한 명이 **참가하기** → 코드 입력
4. 좌측 = 이동 조이스틱 · 우측 = 조준 + 자동 사격

## 컨텐츠

- **15 웨이브** (보스 웨이브 5/10/15)
- **5종 좀비**: Walker · Runner · Spitter · Bomber · Brute
- **3종 픽업**: Health · Damage×2 · Rapid Fire (좀비 처치 시 드랍)
- **콤보 시스템**: 3초 내 연속 처치 = 점수 배율 누적
- **풀스택 P2P**: PeerJS WebRTC DataChannel, 백엔드 없음

## 기술

- Three.js (3D 렌더링 · 블룸 포스트프로세싱 · 셰이더)
- PeerJS (WebRTC 시그널링)
- 프로시저럴 텍스처 · 파티클 · 시네마틱 라이팅
- Vanilla JS, 한 파일 정적 호스팅

## 로컬 실행

```bash
npx serve .
```

브라우저에서 `http://localhost:3000` 열기.
