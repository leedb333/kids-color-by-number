# 원본에서 SVG 퍼즐 재생성

기존 PNG를 임의의 새 구도로 다시 그리지 않고 원본에 충실한 벡터를 생성하는 개발용 도구입니다.
Node 앱, `npm ci`, 빌드와 CI 테스트는 이미 생성된 TypeScript만 사용합니다.

## 입력과 출력

- 입력: `public/assets/source/rainbow-child/rainbow-kid-{color,line}.png`
- 검토 설정: `config.json`의 입력 SHA-256, 원본 닫힌 공간 번호, 큰 목표별 그룹, 색상 추출 위치와 라벨 선호점
- 출력: `src/data/rainbow-child/{palette,regions,decorations,outline}.ts`, `trace-manifest.json`
- 수동 조립: `src/data/rainbow-child/index.ts`의 revision, viewBox, 라벨 크기

원본을 수정하거나 생성 이미지/PNG 스크린샷으로 대체하지 않습니다. 알려진 SHA-256이 다르면
즉시 중단하고 그룹 배정을 재검토하도록 합니다. 현재 원본은 각각 800×999입니다.

## 실행

Python 3.12 환경에서, 저장소의 기존 체크아웃을 사용하세요.

```sh
python3 -m venv /tmp/rainbow-trace-venv
/tmp/rainbow-trace-venv/bin/pip install -r scripts/rainbow-trace/requirements.txt
/tmp/rainbow-trace-venv/bin/python scripts/rainbow-trace/generate.py
npm exec --yes --package=prettier@3.8.1 -- prettier --write src/data/rainbow-child
npm test
npm run build
npm run test:e2e
```

생성 파일을 직접 손으로 수정하면 다음 재생성에서 덮어씁니다. 설정을 변경하고 재생성한 뒤,
실제 터치 완주와 윤곽 비교를 다시 실행하세요. 필요하면 도안 revision도 올립니다.

## 추적 방식

1. 흑백 PNG의 128 미만 픽셀로 검은 윤곽 마스크를 만듭니다.
2. 영역 구분용 마스크에만 2×2 닫기 연산을 해 미세한 구멍을 막고, 225개 흰 공간을 찾습니다.
   화면에 표시할 검은 윤곽은 이 연산을 거치지 않은 원본 마스크에서 추적합니다.
3. 검토한 그룹으로 37개 목표를 만들고 작은 나머지는 가까운 목표에 배정합니다.
   그네·미끄럼틀의 가는 구조 등은 명시적 부모 설정으로 원래 구조를 유지합니다.
4. 컬러 원본의 대응 영역 내부에서 중앙 색상을 추출합니다. 머리 윗부분은 밝은 픽셀의 중앙값을
   사용합니다. 목표 색상은 25개이며 작은 세부 요소도 이 25색 중 가까운 색으로 양자화합니다.
5. Potrace가 닫힌 cubic Bézier와 안쪽 구멍을 생성합니다. `evenodd`로 흰자/속 공간을 보존하고
   실제 원본 윤곽을 맨 위에 그립니다. 터치 영역은 잉크 아래로 1픽셀 확장해 흰 틈을 방지합니다.
6. 큰 목표 내부에서 라벨 위치를 고릅니다. 모두 원본 좌표에서 12픽셀 이상의 내부 여백을 확보하고
   Playwright에서 해당 지점이 실제 자기 path에 닿는지 검증합니다. 얇고 긴 무지개 띠는 확대해 칠할 수 있습니다.

기존의 미세한 명암·수면 반사광을 모두 복사하는 작업은 아니며 평면 25색 퍼즐로 만듭니다.
얼굴/머리/옷/나무/놀이기구/무지개/물웅덩이의 실제 흑백 윤곽은 보존합니다.

## 검증 의미

- 출처: 두 PNG의 SHA-256 및 크기 검증
- 영역: 225개 공간이 중복/누락 없이 37개 목표에 배정되는지 검증
- 기능: 실제 터치 완주, 순서 제한/자동 전환, 저장/이어하기, 힌트/확대, 초기화/되돌리기,
  PNG 픽셀·해상도, 오프라인 실행, 이전 revision 기록 보존
- 형태: SVG 윤곽을 800×999로 래스터화해 원본 검은 픽셀과 비교. 직접 IoU > 90%,
  원본 윤곽의 1픽셀 이내 재현율 > 99.5%를 요구합니다. 이는 윤곽 기준이며
  원본 컬러 이미지 전체의 명암/색상이 동일하다는 지표가 아닙니다.
