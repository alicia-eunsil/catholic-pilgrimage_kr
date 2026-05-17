export type RecommendedCourse = {
  id: string;
  title: string;
  region: string;
  theme: string;
  duration: string;
  transport: string;
  description: string;
  shrineIds: string[];
};

export const recommendedCourses: RecommendedCourse[] = [
  {
    id: "seoul1_course",
    title: "서울 순례자의 목소리",
    region: "서울",
    theme: "서울 순교성지",
    duration: "반나절",
    transport: "대중교통",
    description: "서울 종로지역 순례코스입니다.",
    shrineIds: [
      "경기감영-터",
      "형조-터",
      "의금부-터",
      "좌포도청-터",
      "전옥서-터",
      "우포도청-터",
    ]
  },
  {
    id: "seoul2_course",
    title: "서울 위로의 순례길",
    region: "서울",
    theme: "서울 순교성지",
    duration: "반나절",
    transport: "대중교통",
    description: "서울 종로지역 순례코스입니다.",
    shrineIds: [
      "서소문-밖-네거리-순교성지",
      "김범우의-집-터",
      "명동대성당",
      "광희문-성지",
    ]
  },
  {
    id: "seoul3_course",
    title: "서울 기억과 믿음의 길",
    region: "서울",
    theme: "서울 순교성지",
    duration: "1일",
    transport: "대중교통",
    description: "서울 종로지역 순례코스입니다.",
    shrineIds: [
      "절두산-순교성지",
      "노고산-성지",
      "당고개-순교성지",
      "왜고개성지",
      "새남터-순교성지",
      "삼성산-성지",
    ]
  },
  {
    id: "ganghwa_course",
    title: "강화 순교 코스",
    region: "인천-강화",
    theme: "강화도 내 순교성지",
    duration: "반나절",
    transport: "자동차",
    description: "강화도 내 순례 코스입니다.",
    shrineIds: [
      "갑곶-순교-성지",
      "진무영-순교-성지",
    ]
  },
  {
    id: "north_gg_course",
    title: "경기 평화의 순례",
    region: "경기 북부-춘천",
    theme: "경기 북부-춘천 순교성지",
    duration: "2일",
    transport: "자동차",
    description: "경기도 북부, 강원 춘천 순례 코스입니다.",
    shrineIds: [
      "참회와-속죄의-성당",
      "신암리-성당",
      "갈곡리-성당",
      "양주-순교성지",
      "성-남종삼-요한과-가족-순교자-묘소",
      "황사영-알렉시오-순교자-묘",
      "포천-순교-성지-복자-홍인-레오-순교터",
      "광암이벽요한세례자-진묘터와-생가터",
      "소양로-순례-성당",
      "죽림동-순교-성지",
    ]
  },
  {
    id: "incheon_course",
    title: "인천 순례코스",
    region: "인천",
    theme: "인천 순교성지",
    duration: "반나절",
    transport: "대중교통",
    description: "인천 순례 코스입니다.",
    shrineIds: [
      "이승훈-베드로-묘",
      "제물진두-순교-성지",
    ]
  },
  {
    id: "south_gg1_course",
    title: "경기 기억과 믿음의 길",
    region: "경기남부",
    theme: "경기 남부 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "경기도 남부 안양, 수원, 화성 순례 코스입니다.",
    shrineIds: [
      "수리산성지",
      "손골성지",
      "수원화성순교성지",
      "남양성모성지",
      "요당리성지",
    ]
  },
  {
    id: "south_gg2_course",
    title: "경기 은총의 길",
    region: "경기남부",
    theme: "경기 남부 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "경기도 남부 하남, 광주, 양평 순례 코스입니다.",
    shrineIds: [
      "구산성지",
      "마재-성가정-성지",
      "양근성지",
      "천진암성지",
      "남한산성-순교성지",
    ]
  },
  {
    id: "south_gg3_course",
    title: "경기 빛을 따라 걷는 길",
    region: "경기남부",
    theme: "경기 남부 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "경기도 남부 용인, 이천, 안성 순례 코스입니다.",
    shrineIds: [
      "은이골배마실성지",
      "단내성가정성지",
      "어농성지",
      "죽산성지",
      "미리내성지",
    ]
  },
  {
    id: "west_gw_course",
    title: "강원, 충북 순례코스",
    region: "강원서부,충북",
    theme: "강원 서부, 충북 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "강원도 서부 횡성, 원주, 충북제천 순례코스입니다.",
    shrineIds: [
      "풍수원-성당",
      "강원-감영",
      "성-남종삼-요한--순교자-남상교-아우구스티노-유택지",
      "배론-성지",
    ]
  },
  {
    id: "east_gw_course",
    title: "강원 순례코스",
    region: "강원동부",
    theme: "강원 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "강원도 동부 양양, 삼척, 동해, 삼척 순례코스입니다.",
    shrineIds: [
      "양양-성지",
      "순교자-라-파트리치오-신부-순교터",
      "묵호-순례-성당",
      "성내동-성당",
    ]
  },
  {
    id: "north_cn1_course",
    title: "충남 내포 순례의 길",
    region: "충청남도",
    theme: "충청남도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "충청남도 당진, 아산 순례코스입니다",
    shrineIds: [
      "공세리성당",
      "원머리성지",
      "솔뫼성지",
      "합덕성당",
      "황무실성지",
      "신리성지",
      "여사울성지",
      "남방제성지",
    ]
  },
  {
    id: "north_cn2_course",
    title: "충남 고요한 기도의 길",
    region: "충청남도",
    theme: "충청남도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "충청남도 서산, 홍성 순례코스입니다",
    shrineIds: [
      "해미순교자국제성지",
      "배나드리성지",
      "홍주순교성지",
      "대흥봉수산순교성지",
    ]
  },
  {
    id: "north_cn3_course",
    title: "충남 신앙의 발자취",
    region: "충청남도",
    theme: "충청남도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "충청남도 보령, 청양, 공주 순례코스입니다",
    shrineIds: [
      "갈매못순교성지",
      "청양다락골성지",
      "수리치골-성모성지",
      "황새바위순교성지",
    ]
  },
  {
    id: "north_cn4_course",
    title: "충남 마음의 순례",
    region: "충청남도",
    theme: "충청남도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "충청남도 부여, 서천 순례코스입니다",
    shrineIds: [
      "도앙골-성지",
      "삽티-성지",
      "서짓골-성지",
      "산막골성지--작은재성지",
      "지석리성지",
    ]
  },
  {
    id: "cj_course",
    title: "청주 성지로 향하는 여정",
    region: "충청북도",
    theme: "충청북도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "충청북도 진천, 청주, 보은 순례코스입니다",
    shrineIds: [
      "성거산성지",
      "배티-순교-성지",
      "서운동-순교-성지",
      "멍에목-성지",
    ]
  },
  {
    id: "ad_course",
    title: "문경 믿음의 발자취",
    region: "경상북도",
    theme: "경상북도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "충청북도 괴산, 경상북도 문경 순례코스입니다",
    shrineIds: [
      "연풍-순교-성지",
      "마원-성지",
      "진안리-성지",
      "여우목-성지",
    ]
  },
  {
    id: "north_jj_course",
    title: "전북 순교자의 길",
    region: "전라북도",
    theme: "전라북도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "전라북도 익산, 충청남도 금산 순례코스입니다",
    shrineIds: [
      "진산성지",
      "천호성지",
      "여산-하늘의-문-성당",
      "나바위성지",
    ]
  },
  {
    id: "center_jj_course",
    title: "전북 위로의 순례길",
    region: "전라북도",
    theme: "전라북도 순교성지",
    duration: "1일",
    transport: "자동차",
    description: "전라북도 김제, 전주 순례코스입니다",
    shrineIds: [
      "김제순교성지",
      "초남이성지",
      "전주숲정이성지",
      "전주옥터",
      "전동성당",
      "서천교순교터",
      "초록바위순교터",
      "치명자산성지",
    ]
  },
  {
    id: "gj_course",
    title: "전라도 함께하는 순례길",
    region: "전라남도",
    theme: "전라남도 순교성지",
    duration: "2일",
    transport: "자동차",
    description: "전라북도 고창, 전라남도 영광, 나주, 목포, 곡성 순례코스입니다.",
    shrineIds: [
      "고창-개갑-순교성지",
      "영광순교자기념성당",
      "나주-순교자-기념성당",
      "가톨릭목포성지",
      "곡성성당-옥터",
    ]
  },
  {
    id: "dg_course",
    title: "경상북도 신앙의 발자취",
    region: "경상북도",
    theme: "경상북도 순교성지",
    duration: "2일",
    transport: "자동차",
    description: "경상북도 대구, 경주 순례코스입니다.",
    shrineIds: [
      "한티순교성지",
      "신나무골-성지",
      "비산날뫼성당",
      "경상-감영과-옥-터",
      "관덕정순교기념관",
      "복자성당",
      "진목정-성지",
      "경주-관아와-옥-터",
    ]
  },
  {
    id: "ms_course",
    title: "경상남도 숲과 기도의 길",
    region: "경상남도",
    theme: "경상남도 순교성지",
    duration: "2일",
    transport: "자동차",
    description: "경상남도 창원, 함안, 거제 순례코스입니다.",
    shrineIds: [
      "명례-성지",
      "복자-박대식-빅토리노-묘",
      "대산성당",
      "복자-정찬문-안토니오-묘소",
      "복자-윤봉문-요셉-성지",
    ]
  },
  {
    id: "jj_course",
    title: "제주도 고요한 침묵",
    region: "제주도",
    theme: "제주도 순교성지",
    duration: "반나절",
    transport: "자동차",
    description: "제주도 순례코스입니다.",
    shrineIds: [
      "김기량-순교-기념관",
      "용수-성지",
    ]
  }
];
