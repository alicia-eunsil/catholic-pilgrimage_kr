export type ShrineCategory = "성지" | "순교사적지" | "순례지";

export type Shrine = {
  id: string;
  name: string;
  category: ShrineCategory;
  diocese: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  description: string;
};

export const shrines: Shrine[] = [
  {
    id: "jeoldusan-martyrs-shrine",
    name: "절두산 순교성지",
    category: "성지",
    diocese: "서울대교구",
    address: "서울특별시 마포구 토정로 6",
    region: "서울",
    lat: 37.5446,
    lng: 126.9113,
    description: "한강변 순교 역사를 기억하는 서울의 대표 순례 성지입니다."
  },
  {
    id: "saenamteo",
    name: "새남터 순교성지",
    category: "순교사적지",
    diocese: "서울대교구",
    address: "서울특별시 용산구 이촌로 80-8",
    region: "서울",
    lat: 37.5236,
    lng: 126.9547,
    description: "조선 후기 천주교 순교자들의 신앙을 기리는 순교 사적지입니다."
  },
  {
    id: "myeongdong-cathedral",
    name: "명동대성당",
    category: "순례지",
    diocese: "서울대교구",
    address: "서울특별시 중구 명동길 74",
    region: "서울",
    lat: 37.5632,
    lng: 126.9874,
    description: "한국 천주교회의 상징적인 주교좌성당이자 도심 순례지입니다."
  },
  {
    id: "solmoe-shrine",
    name: "솔뫼성지",
    category: "성지",
    diocese: "대전교구",
    address: "충청남도 당진시 우강면 솔뫼로 132",
    region: "충남",
    lat: 36.8137,
    lng: 126.7673,
    description: "김대건 신부의 탄생지로 알려진 한국 천주교의 중요한 성지입니다."
  },
  {
    id: "haemi-martyrdom-site",
    name: "해미순교성지",
    category: "순교사적지",
    diocese: "대전교구",
    address: "충청남도 서산시 해미면 성지1로 13",
    region: "충남",
    lat: 36.7147,
    lng: 126.5455,
    description: "많은 무명 순교자들의 신앙을 기억하는 순교성지입니다."
  },
  {
    id: "galmaemot",
    name: "갈매못순교성지",
    category: "순교사적지",
    diocese: "대전교구",
    address: "충청남도 보령시 오천면 오천해안로 610",
    region: "충남",
    lat: 36.4385,
    lng: 126.5214,
    description: "바닷가 순교의 역사를 품은 충청 지역 순례지입니다."
  },
  {
    id: "baeron",
    name: "배론성지",
    category: "성지",
    diocese: "원주교구",
    address: "충청북도 제천시 봉양읍 배론성지길 296",
    region: "충북",
    lat: 37.1324,
    lng: 128.1546,
    description: "한국 천주교 초기 신앙 공동체와 교육의 흔적이 남아 있는 성지입니다."
  },
  {
    id: "namhansanseong",
    name: "남한산성 순교성지",
    category: "순교사적지",
    diocese: "수원교구",
    address: "경기도 광주시 남한산성면 남한산성로 763-58",
    region: "경기",
    lat: 37.4784,
    lng: 127.1816,
    description: "박해 시대 순교의 흔적이 남아 있는 수도권 순례지입니다."
  }
];

export const categories: Array<"전체" | ShrineCategory> = ["전체", "성지", "순교사적지", "순례지"];
