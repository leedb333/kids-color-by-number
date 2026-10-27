# 경찰차 로봇 원본 추적

최신 main에 업로드된 `public/assets/source/police-car-robot/{color-reference,line-reference}.png`를 직접 읽습니다. 두 원본은 각각 800×999입니다. 입력 해시가 달라지거나 파일이 없거나 읽히지 않으면 생성하지 않습니다. 임의 그림/사진 배경/투명 터치 오버레이는 사용하지 않습니다.

## 데이터 계약

- `config.json`: 실제 입력 SHA-256, 검토한 원본 면 번호와 물체별 ID, 28개 색상 추출 기준
- `src/data/police-car-robot/palette.ts`: 정확히 ID 1~28과 서로 다른 28개 불투명 HEX
- `regions.ts`: 각 면의 고유 `id`, 순서용 `colorId`, 실제 색인 `fill`, 닫힌 베지어, 숫자 위치/크기/내부 반경
- `outline.ts`: 흑백 원본의 검은 윤곽을 추적한 SVG path
- `decorations.ts`: 상시 검정/흰색인 비색칠 미세 요소. `paintWith` 없음
- `manifest.json`: 원본 해시/공간/영역/실제 색상/비색칠 사유 목록

**색상 번호는 진행 단계이며 일괄 채색 명령이 아닙니다.** 한 번의 터치는 지정한 하나의 ID만 기록합니다. 같은 번호의 모든 필수 ID를 각각 칠해야 다음 단계로 갑니다. 경찰차와 로봇의 경광등, 문과 별, 팔과 다리, 바퀴와 중심축을 합치지 않습니다.

흑백의 닫힌 공간 183개 중 134개는 각각 별도의 목표입니다. 컬러 원본의 불투명 흰 전구를 주변 전조등에서 한 번 더 분리하여 **135개 터치 목표**가 됩니다. 전구는 흑백 선의 열린 틈 때문에 주변 전조등과 연결되어 있었으므로 컬러 원본의 실제 흰 픽셀을 사용해 분리했습니다. 주변 면은 해당 전구를 뺀 연결 면이며 전구를 함께 채우지 않습니다.

49개 얇은 눈 흰자/눈빛/틈/손잡이/연결선은 고정 검정/흰색으로 남깁니다. 시작과 완성에서 동일하므로 다른 면을 터치해도 바뀌지 않습니다. 모든 제외 사유와 좌표는 `docs/police-car-robot/non-paintable.md`에 있습니다. 작은 후미등·입안·중심축 등은 필수 개별 면으로 유지하고 힌트가 해당 위치를 확대합니다. 최대 1600% 확대를 지원합니다.

## 재생성

개발용 Python 3.12 및 Node 24를 사용합니다. 앱/일반 npm 빌드/CI에는 Python이 필요하지 않습니다.

```sh
python3 -m venv /tmp/police-trace-venv
/tmp/police-trace-venv/bin/pip install -r scripts/police-trace/requirements.txt
/tmp/police-trace-venv/bin/python scripts/police-trace/generate.py
npm exec --yes --package=prettier@3.8.1 -- prettier --write src/data/police-car-robot
npm exec --yes --package=tsx@4.21.0 -- tsx scripts/police-trace/render.tsx
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm exec --yes --package=tsx@4.21.0 -- tsx scripts/police-trace/compare.ts
npm test
npm run build
npm run test:e2e
```

기본 Playwright Chromium을 설치한 환경에서는 비교 스크립트의 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`를 생략할 수 있습니다. 생성 후 모든 면을 실제 터치하고, 비교 이미지를 확인해야 합니다. 원본 변경 시 면 번호/색상/라벨/개별 연결성을 다시 검토하고 도안 revision을 올립니다. 경찰차의 데이터·revision·저장 키는 그대로 유지합니다.

## 색상과 비교의 의미

28색은 배경과 윤곽을 포함한 **SVG의 실제 평면 채우기 HEX** 수입니다. 명암 그라데이션·반투명/광택 효과를 제거합니다. PNG는 경계의 안티앨리어싱으로 중간 픽셀이 생기므로 PNG 픽셀 RGB 종류 수를 28이라고 주장하지 않습니다.

`render.tsx`는 앱과 같은 `Artwork` 및 같은 영역 데이터로 시작/완성 SVG를 만듭니다. `compare.ts`는 원본 PNG와 이 SVG를 브라우저로 나란히 렌더링하여 `comparison.png`, `line-comparison.png`, `details.png`와 윤곽 지표를 저장합니다.

윤곽 비교는 원본 흑백과 벡터 윤곽의 픽셀 IoU 및 1픽셀 이내 재현율을 검사합니다. 경찰차 얼굴, 로봇 얼굴, 양팔, 다리, 각 바퀴 부분도 별도로 검사합니다. 이는 형태 일치도이며 그라데이션을 포함한 원본 컬러 이미지 전체의 동일성을 뜻하지 않습니다.
