export const categories = [
  { id: "cash", label: "현금·예금", color: "#7d9c78", icon: "wallet" },
  { id: "stock", label: "주식·ETF", color: "#d5aa65", icon: "chart" },
  { id: "crypto", label: "가상자산", color: "#7b86b3", icon: "coin" },
  { id: "property", label: "부동산", color: "#344d3c", icon: "home" },
  { id: "other", label: "기타 자산", color: "#9b9da7", icon: "gem" },
] as const;

export type Category = (typeof categories)[number]["id"];
export type Targets = Record<Category, number>;
export type Asset = {
  id: string;
  name: string;
  category: Category;
  cost: number;
  value: number;
  note: string;
  pricing?: { kind: "upbit"; market: string; quantity: number };
};
export type Portfolio = {
  version: 1;
  assets: Asset[];
  targets: Targets;
  isDemo: boolean;
};
export const storageKey = "moa-portfolio-v1";
export const maxAmount = 9_000_000_000_000;
export const defaultTargets: Targets = {
  cash: 15,
  stock: 30,
  crypto: 0,
  property: 50,
  other: 5,
};

export function demoPortfolio(): Portfolio {
  return {
    version: 1,
    isDemo: true,
    targets: { ...defaultTargets },
    assets: [
      {
        id: "demo-1",
        name: "생활비 통장",
        category: "cash",
        cost: 8_500_000,
        value: 8_500_000,
        note: "비상금과 생활비",
      },
      {
        id: "demo-2",
        name: "정기예금",
        category: "cash",
        cost: 30_000_000,
        value: 30_000_000,
        note: "만기 예정 예금",
      },
      {
        id: "demo-3",
        name: "국내 주식",
        category: "stock",
        cost: 25_000_000,
        value: 28_500_000,
        note: "직접 입력한 평가금액",
      },
      {
        id: "demo-4",
        name: "미국 S&P 500 ETF",
        category: "stock",
        cost: 40_000_000,
        value: 46_000_000,
        note: "원화 환산 평가금액",
      },
      {
        id: "demo-5",
        name: "거주 아파트",
        category: "property",
        cost: 200_000_000,
        value: 230_000_000,
        note: "보유 지분의 추정 평가금액",
      },
      {
        id: "demo-6",
        name: "금 투자",
        category: "other",
        cost: 5_000_000,
        value: 5_500_000,
        note: "직접 입력한 평가금액",
      },
    ],
  };
}

export function totals(assets: Asset[]) {
  const cost = assets.reduce((sum, a) => sum + a.cost, 0);
  const value = assets.reduce((sum, a) => sum + a.value, 0);
  const profit = value - cost;
  return { cost, value, profit, rate: cost > 0 ? (profit / cost) * 100 : null };
}

export function allocation(assets: Asset[], targets: Targets) {
  const total = totals(assets).value;
  return categories.map((category) => {
    const value = assets
      .filter((a) => a.category === category.id)
      .reduce((sum, a) => sum + a.value, 0);
    const share = total > 0 ? (value / total) * 100 : 0;
    const targetValue = (total * targets[category.id]) / 100;
    return {
      ...category,
      value,
      share,
      target: targets[category.id],
      gap: targets[category.id] - share,
      adjustment: Math.round(targetValue - value),
    };
  });
}

export function validTargets(targets: Targets): boolean {
  return (
    categories.every(
      (c) =>
        Number.isFinite(targets[c.id]) &&
        targets[c.id] >= 0 &&
        targets[c.id] <= 100,
    ) &&
    Math.abs(categories.reduce((sum, c) => sum + targets[c.id], 0) - 100) <
      0.00001
  );
}

export function assetError(asset: Omit<Asset, "id">): string | null {
  if (!asset.name.trim() || asset.name.trim().length > 60)
    return "자산 이름을 1~60자로 입력해 주세요.";
  if (!categories.some((c) => c.id === asset.category))
    return "자산 유형을 선택해 주세요.";
  if (
    ![asset.cost, asset.value].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= maxAmount,
    )
  ) {
    return "금액은 0원부터 9조 원까지, 원 단위 정수로 입력해 주세요.";
  }
  if (asset.note.length > 200) return "메모는 200자 이내로 입력해 주세요.";
  if (asset.pricing !== undefined) {
    const p = asset.pricing;
    if (
      !p ||
      p.kind !== "upbit" ||
      asset.category !== "crypto" ||
      typeof p.market !== "string" ||
      !/^KRW-[A-Z0-9]{1,20}$/.test(p.market)
    )
      return "업비트 원화 마켓의 가상자산을 선택해 주세요.";
    if (
      !Number.isFinite(p.quantity) ||
      p.quantity < 0 ||
      p.quantity > 1_000_000_000
    )
      return "보유 수량은 0 이상 10억 이하의 숫자로 입력해 주세요.";
  }
  return null;
}

export function parsePortfolio(text: string): Portfolio {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object")
    throw new Error("올바른 백업 파일이 아닙니다.");
  const p = data as Portfolio;
  const targets = p.targets && {
    ...p.targets,
    crypto: p.targets.crypto === undefined ? 0 : p.targets.crypto,
  };
  if (
    p.version !== 1 ||
    typeof p.isDemo !== "boolean" ||
    !Array.isArray(p.assets) ||
    !p.targets ||
    !validTargets(targets) ||
    p.assets.length > 1000
  ) {
    throw new Error("지원하지 않는 형식이거나 자산 배분이 올바르지 않습니다.");
  }
  const ids = new Set<string>();
  for (const a of p.assets) {
    if (
      !a ||
      typeof a.id !== "string" ||
      !a.id ||
      ids.has(a.id) ||
      typeof a.name !== "string" ||
      typeof a.note !== "string" ||
      assetError(a)
    ) {
      throw new Error("백업 파일의 자산 정보가 올바르지 않습니다.");
    }
    ids.add(a.id);
  }
  return {
    version: 1,
    isDemo: p.isDemo,
    targets: Object.fromEntries(
      categories.map((c) => [c.id, targets[c.id]]),
    ) as Targets,
    assets: p.assets.map((a) => ({
      id: a.id,
      name: a.name.trim(),
      category: a.category,
      cost: a.cost,
      value: a.value,
      note: a.note,
      ...(a.pricing
        ? {
            pricing: {
              kind: "upbit" as const,
              market: a.pricing.market,
              quantity: a.pricing.quantity,
            },
          }
        : {}),
    })),
  };
}

export function money(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(amount)) + "원";
}

export function compactMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 100_000_000)
    return `${(amount / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억`;
  if (abs >= 10_000)
    return `${(amount / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만`;
  return money(amount);
}

export function percentage(value: number | null, signed = false): string {
  if (value === null) return "—";
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
