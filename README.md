# catholic-pilgrimage_kr

한국 천주교 성지순례를 지도와 추천코스로 살펴보고, 방문기록을 남기는 모바일 중심 웹 서비스입니다.

## 주요 기능

- 전국 성지 지도 탐색
- `성지 / 순교사적지 / 순례지` 다중 필터
- 성지명, 교구, 주소 검색
- 추천코스 지도 표시
- 성지별 네이버 블로그 후기 검색 링크
- GPS 기준 100m 이내 방문 인증 표시
- 닉네임, 한줄소감, 인증사진 방문기록 저장
- 인증사진 HEIC 변환 및 이미지 자동 압축
- 전체 인증기록과 성지별 인증 통계 조회

## 기술 구성

- Next.js 14
- React 18
- TypeScript
- Kakao Maps JavaScript SDK
- Firebase Authentication 익명 인증
- Firebase Firestore
- Firebase Storage
- Vercel 배포

## 데이터 입력

성지 원본 데이터는 프로젝트 루트의 `korean_catholic_holy_sites.xlsx`에 입력합니다.

필수 컬럼:

```csv
성지명,구분,소속교구,주소
```

`구분` 값은 아래 셋 중 하나여야 합니다.

```text
성지
순교사적지
순례지
```

## 데이터 변환

주소를 좌표로 변환하려면 Kakao Local REST API 키를 환경변수로 설정한 뒤 실행합니다.

```bash
export KAKAO_REST_API_KEY="..."
npm run geocode
npm run build:data
```

생성 결과:

- `data/korean_catholic_holy_sites.geocoded.csv`
- `src/data/shrines.ts`
- `src/data/courses.ts`

`추천코스` 시트를 수정한 뒤에는 코스 데이터도 다시 생성해야 합니다.

```bash
npm run build:courses
```

성지 데이터와 추천코스를 함께 갱신하려면 아래 명령을 사용합니다.

```bash
npm run build:data
```

## 로컬 실행

```bash
npm install
npm run dev
```

## 배포

GitHub 저장소를 Vercel 프로젝트에 연결해서 배포합니다.

환경변수는 Vercel Project Settings의 Environment Variables에 등록합니다. 실제 키 값은 저장소에 커밋하지 않습니다.

필요한 환경변수:

```text
NEXT_PUBLIC_KAKAO_MAP_KEY
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
```

## Firebase 설정

Authentication:

- 익명 로그인 사용

Firestore:

- `visits` 컬렉션 사용
- 인증 기록, GPS 인증 여부, 사진 URL 저장

Storage:

- `visit-photos/` 경로 사용
- 업로드 전 클라이언트에서 이미지를 JPEG로 변환/압축

운영 규칙은 Firebase 콘솔에서 관리하고, 민감한 키나 프로젝트 운영값은 문서에 기록하지 않습니다.
