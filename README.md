# catholic-pilgrimage_kr

성지순례를 계획하고, 좌표 기반 코스를 만들고, 로그인 없이 방문 인증 기록을 남기는 모바일 웹 MVP입니다.

## 현재 구현 범위

- 성지 지도형 탐색 화면
- `성지 / 순교사적지 / 순례지` 구분 필터
- 성지명, 교구, 주소 검색
- 네이버 블로그 후기 검색 링크
- 여러 성지 선택 후 좌표 기반 최단 순서 추천
- GPS 기준 500m 이내 방문 인증 판정
- 로그인 없는 닉네임, 사진, 한줄소감 방문 기록
- 브라우저 `localStorage` 기반 개인 기록 저장

## 데이터 입력

엑셀에는 아래 4개 컬럼만 입력합니다.

```csv
성지명,구분,소속교구,주소
절두산 순교성지,성지,서울대교구,서울특별시 마포구 토정로 6
새남터 순교성지,순교사적지,서울대교구,서울특별시 용산구 이촌로 80-8
명동대성당,순례지,서울대교구,서울특별시 중구 명동길 74
```

실제 입력 파일명은 프로젝트 루트의 `korean_catholic_holy_sites.xlsx`입니다.

## 지오코딩

Kakao Local API REST 키를 환경변수로 설정한 뒤 실행합니다.

```bash
export KAKAO_REST_API_KEY="카카오_REST_API_KEY"
npm run geocode
```

결과는 `data/korean_catholic_holy_sites.geocoded.csv`에 저장됩니다.

## 실행

로컬 실행에는 Node.js가 필요합니다.

```bash
npm install
npm run dev
```

Vercel에는 GitHub 저장소를 연결해서 배포하면 됩니다.

## 환경변수

카카오맵 표시에는 아래 환경변수가 필요합니다.

```bash
NEXT_PUBLIC_KAKAO_MAP_KEY="카카오_JavaScript_키"
```

Vercel 프로젝트의 Environment Variables에도 같은 이름으로 등록해야 합니다.

## 다음 개발 단계

1. `data/korean_catholic_holy_sites.geocoded.csv`를 앱용 TypeScript/JSON 데이터로 자동 변환
2. 네이버 블로그 검색 API 서버 라우트 추가
3. 방문 기록을 서버에 저장할지 여부 재검토
