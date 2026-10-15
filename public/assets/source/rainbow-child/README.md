# 무지개를 바라보는 아이 — 참고 원본 보관 위치

대화에서 컬러 완성본과 흑백 도안의 모습을 확인해 SVG를 수동으로 단순화했습니다.
현재 실행 환경에는 첨부 PNG의 파일 경로나 다운로드 ID가 전달되지 않았습니다.
**이 폴더에는 아직 원본 PNG가 없습니다. 생성한 이미지나 스크린샷을 원본으로 대신 저장하지 않았습니다.**

다운로드 가능한 두 PNG 원본을 전달받으면 저장소 루트에서 실행하세요.

```sh
node scripts/import-rainbow-sources.mjs /path/to/color.png /path/to/outline.png
```

- `color-reference.png`: 전달받은 컬러 완성본, 원본 바이트 보존
- `outline-reference.png`: 전달받은 흑백 도안, 원본 바이트 보존
- `sources.json`: 실제로 복사한 파일의 크기와 SHA-256

스크립트는 기존 파일을 덮어쓰지 않습니다. PNG는 비교/보관 자료이며 플레이 화면은
`src/data/rainbow-child/`의 닫힌 SVG 영역을 사용하므로 원본 파일 부재가 실행을 막지 않습니다.
원본은 큰 참고 자료라 서비스 워커의 필수 오프라인 캐시에 넣지 않습니다.
