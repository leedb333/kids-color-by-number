# 경찰차 로봇 실제 원본

- `color-reference.png`: 업로드된 컬러 원본, 800×999. 28색 추출 및 흰 전구 면 분리 기준.
- `line-reference.png`: 업로드된 흑백 원본, 800×999. 경찰차/로봇/화살표/별의 실제 영역과 윤곽 추적 기준.
- `sources.json`: 실제 원본의 SHA-256과 크기. 테스트에서 현재 파일과 비교합니다.

원본 PNG는 변경하지 않았습니다. 앱은 이 PNG를 배경으로 겹쳐 표시하지 않고 `src/data/police-car-robot/`에 생성한 실제 SVG path를 사용합니다. 재생성/독립 터치 계약은 `scripts/police-trace/README.md`, 비교 자료는 `docs/police-car-robot/`에 있습니다.
