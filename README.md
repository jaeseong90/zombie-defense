# 🧟 Dead Corridor — 2P Co-op Defense (PWA)

모바일 가로 모드 트윈스틱 슈터. 두 명이 등 맞대고 좀비 10웨이브를 막아내세요. 약 10분 분량.

## 플레이 방법

1. 가로 모드 폰 2대 (또는 PC 브라우저 탭 2개)
2. **홈 화면에 추가** → 풀스크린 가로 락 (PWA)
3. 한 명이 **방 만들기** → 6자리 코드 공유
4. 다른 한 명이 **참가하기** → 코드 입력
5. 좌측 = 이동 조이스틱 · 우측 = 조준 + 자동 사격

## 컨텐츠

- **10 웨이브** (보스 웨이브 4/7/10) · 약 10분 플레이
- **5종 좀비**: Walker · Runner · Spitter · Bomber · Brute
- **3종 픽업**: Health · Damage×2 · Rapid Fire (좀비 처치 시 드랍)
- **콤보 시스템**: 3초 내 연속 처치 = 점수 배율 누적
- **풀스택 P2P**: PeerJS WebRTC DataChannel, 백엔드 없음

## PWA

- `display: fullscreen` + `orientation: landscape` 매니페스트
- 서비스 워커로 오프라인 캐싱
- iOS Safari · Android Chrome 모두 홈 화면 추가 지원

## 기술

- Three.js (3D 렌더링 · 블룸 포스트프로세싱 · 셰이더)
- PeerJS (WebRTC 시그널링)
- 프로시저럴 텍스처 · 파티클 · 시네마틱 라이팅
- 모바일 자동 감지: DPR 1.5 · 그림자맵 1024 · PCF 일반
- Vanilla JS, 정적 호스팅

## 로컬 실행

```bash
npx serve .
```

브라우저에서 `http://localhost:3000` 열기.
