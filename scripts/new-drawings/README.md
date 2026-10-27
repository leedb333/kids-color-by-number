# 새 도안 4개 제작 도구

ImageGen 원본의 닫힌 색상 영역을 분석해 SVG path로 변환합니다.
경찰차 도안 파일은 읽거나 변경하지 않습니다. 브라우저에는 Python이 필요 없습니다.

```sh
python -m pip install -r scripts/new-drawings/requirements.txt
python scripts/new-drawings/generate.py
```

입력: `public/assets/source/<id>/generated-reference.png`.
출력: `src/data/new-drawings/<id>.json`과 원본 폴더의 `manifest.json`.
원본이 없을 때만 최초 생성 세션의 `.codex/generated_images` 경로에서 복사합니다.
원본이 저장소에 있으면 그 파일을 사용하므로 다른 컴퓨터에서도 재생성할 수 있습니다.
원본은 덮어쓰지 않습니다. 원본 교체 시 데이터를 검토하고 도안 revision을 올리세요.

각 연결된 공간은 독립적인 색칠 영역입니다. 번호는 최대 내부 거리 지점에 놓습니다.
너무 작거나 어두운 세부 요소는 고정된 검정·흰색 장식으로 둡니다. 배경은 단색으로
통일하고, 색칠 영역은 28개의 불투명 단색 팔레트로 정리합니다. 숫자 위치의 실제
터치 판정은 브라우저 검사에서 모든 영역에 대해 확인합니다.

원본 생성 프롬프트는 config.json과 각 manifest.json에 보관했습니다.
새 도안의 최종 PNG는 원본 이미지가 아닌 실제 앱 SVG에서 저장합니다.
