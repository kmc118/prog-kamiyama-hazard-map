import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TILE_SIZE = 256;
const KAMIYAMA_CENTER = { lat: 33.9677, lng: 134.3504 };
const MIN_ZOOM = 12;
const MAX_ZOOM = 20;
const MAX_TILE_ZOOM = 19;
const PINCH_ZOOM_SENSITIVITY = 1.68;
const WHEEL_ZOOM_SENSITIVITY = 0.00868;
const SEEN_COOLDOWN_MS = 15 * 60 * 1000;
const WEATHER_REFRESH_MS = 10 * 60 * 1000;
const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_DATA_URL = `${import.meta.env.BASE_URL}data/progq205-3.geojson`;
const ROUTE_API_URL = "https://router.project-osrm.org/route/v1/driving";
const MATCH_API_URL = "https://router.project-osrm.org/match/v1/driving";
const ROUTE_STORAGE_KEY = "kamiyama-school-route-my-routes-v1";
const ROUTE_HAZARD_DISTANCE_METERS = 55;
const CLUSTER_MAX_ZOOM = 14.5;
const CLUSTER_RADIUS = 72;

const WEATHER_LABELS = {
  0: "快晴",
  1: "晴れ",
  2: "晴れ時々くもり",
  3: "くもり",
  45: "霧",
  48: "霧氷",
  51: "弱い霧雨",
  53: "霧雨",
  55: "強い霧雨",
  56: "着氷性の弱い霧雨",
  57: "着氷性の強い霧雨",
  61: "弱い雨",
  63: "雨",
  65: "強い雨",
  66: "弱い着氷性雨",
  67: "強い着氷性雨",
  71: "弱い雪",
  73: "雪",
  75: "強い雪",
  77: "雪粒",
  80: "にわか雨",
  81: "強いにわか雨",
  82: "激しいにわか雨",
  85: "にわか雪",
  86: "強いにわか雪",
  95: "雷雨",
  96: "雹を伴う雷雨",
  99: "激しい雷雨"
};

const PIN_COLORS = {
  red: { label: "防災", value: "#e5484d", dot: "🔴" },
  blue: { label: "防犯", value: "#2f80ed", dot: "🔵" },
  yellow: { label: "生物", value: "#f2c94c", dot: "🟡" },
  green: { label: "交通", value: "#27ae60", dot: "🟢" },
  gray: { label: "その他", value: "#7a8491", dot: "⚪" }
};

function pinMatchesFilter(pin, filter) {
  if (filter === "all") return true;
  if (filter === "vending") return pin.kind === "vending";
  return pin.kind !== "vending" && pin.color === filter;
}

const DANGER_LEVELS = {
  1: "★",
  2: "★★",
  3: "★★★"
};

const VENDING_PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 440'%3E%3Crect width='720' height='440' fill='%23e8f3f2'/%3E%3Ccircle cx='360' cy='220' r='170' fill='%23fff' stroke='%23146768' stroke-width='16'/%3E%3Crect x='254' y='78' width='212' height='294' rx='22' fill='%23146768'/%3E%3Crect x='278' y='108' width='164' height='108' rx='10' fill='%23d9f1ed'/%3E%3Ccircle cx='314' cy='144' r='16' fill='%23ef5b5b'/%3E%3Ccircle cx='360' cy='144' r='16' fill='%23f3c64e'/%3E%3Ccircle cx='406' cy='144' r='16' fill='%234b82dc'/%3E%3Ccircle cx='314' cy='186' r='16' fill='%234b82dc'/%3E%3Ccircle cx='360' cy='186' r='16' fill='%2356ae70'/%3E%3Ccircle cx='406' cy='186' r='16' fill='%23ef5b5b'/%3E%3Crect x='278' y='242' width='104' height='98' rx='8' fill='%23f5f8f7'/%3E%3Crect x='398' y='246' width='44' height='22' rx='6' fill='%23f3c64e'/%3E%3Crect x='398' y='286' width='44' height='12' rx='5' fill='%230e4f50'/%3E%3C/svg%3E";

const LEGACY_TEST_PINS = [
  {
    id: "open-data-crossing",
    title: "横断注意ポイント",
    color: "red",
    dangerLevel: 3,
    lat: 33.96872,
    lng: 134.34878,
    detail: "県道沿いの横断箇所。登校時間帯は車両の流れが続くため、見守り確認を優先。",
    source: "作成データ: 通学路安全点検",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 440'%3E%3Crect width='720' height='440' fill='%23e9f2ea'/%3E%3Cpath d='M0 304h720v136H0z' fill='%23697865'/%3E%3Cpath d='M0 244h720v76H0z' fill='%238d9381'/%3E%3Cpath d='M72 278h86M218 278h86M364 278h86M510 278h86' stroke='%23fff7cf' stroke-width='15' stroke-linecap='round'/%3E%3Cpath d='M0 228c110-68 218-72 324-12 106 60 238 58 396-8v-208H0z' fill='%238bbd7f'/%3E%3Ccircle cx='570' cy='95' r='46' fill='%23f3c94f'/%3E%3Cpath d='M112 366h210' stroke='%23ffffff' stroke-width='18' stroke-linecap='round'/%3E%3Cpath d='M412 356h188' stroke='%23ffffff' stroke-width='18' stroke-linecap='round'/%3E%3C/svg%3E"
  },
  {
    id: "open-data-narrow-road",
    title: "道幅が狭い区間",
    color: "yellow",
    dangerLevel: 2,
    lat: 33.96692,
    lng: 134.35342,
    detail: "歩道の余裕が小さい区間。雨天時や下校時間帯は車との距離に注意。",
    source: "作成データ: 通学路安全点検",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 440'%3E%3Crect width='720' height='440' fill='%23dfeee9'/%3E%3Cpath d='M0 0h720v182H0z' fill='%2389bd8b'/%3E%3Cpath d='M276 440 350 168h96l122 272z' fill='%23787f75'/%3E%3Cpath d='M364 440 416 168' stroke='%23ffffff' stroke-width='10' stroke-dasharray='34 28'/%3E%3Cpath d='M0 294c76-38 150-54 224-48 66 5 126 27 182 66 84 58 188 62 314 12v116H0z' fill='%237fb178'/%3E%3Cpath d='M78 216h122l28 224H50z' fill='%235d8e62'/%3E%3Cpath d='M552 188h106l42 252H528z' fill='%2359855e'/%3E%3C/svg%3E"
  },
  {
    id: "open-data-riverside",
    title: "川沿いの見通し確認",
    color: "blue",
    dangerLevel: 2,
    lat: 33.97018,
    lng: 134.35708,
    detail: "水路付近の曲がり角。自転車と歩行者が交差するため、合流前の確認が必要。",
    source: "作成データ: 通学路安全点検",
    image:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 440'%3E%3Crect width='720' height='440' fill='%23edf4ed'/%3E%3Cpath d='M0 232c150-72 284-68 402 12 92 62 198 72 318 30v166H0z' fill='%236eaa75'/%3E%3Cpath d='M0 326c154-30 276-24 366 18 106 50 224 46 354-12v108H0z' fill='%234e9fca'/%3E%3Cpath d='M0 258c128-52 248-55 360-8 104 44 224 42 360-6v62c-144 54-276 54-396 0-96-42-204-38-324 12z' fill='%23756f61'/%3E%3Cpath d='M78 280h100M226 282h100M374 282h100M522 282h100' stroke='%23f8f2d5' stroke-width='12' stroke-linecap='round'/%3E%3C/svg%3E"
  }
];

const HAZARD_PLACEHOLDER_IMAGE = LEGACY_TEST_PINS[0].image;
const INITIAL_PINS = [];
const STORAGE_KEY = "kamiyama-school-route-hazard-pins-v3";
const LEGACY_STORAGE_KEY = "kamiyama-school-route-hazard-pins-v2";

function normalizePin(pin) {
  const isVending =
    pin.kind === "vending" || String(pin.source || "").includes("自動販売機");
  const dangerLevel = Math.min(3, Math.max(1, Number(pin.dangerLevel) || 1));

  return {
    ...pin,
    kind: isVending ? "vending" : "hazard",
    color: PIN_COLORS[pin.color] ? pin.color : "gray",
    dangerLevel
  };
}

function latLngToPoint(lat, lng, zoom) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y:
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
      scale
  };
}

function pointToLatLng(x, y, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getTileZoom(zoom) {
  return Math.min(MAX_TILE_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
}

function getTouchDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getTouchMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

function loadPinState() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved)) {
      return { userPins: saved, editedBasePins: {}, seenByPin: {} };
    }

    return {
      userPins: Array.isArray(saved.userPins) ? saved.userPins : [],
      editedBasePins:
        saved.editedBasePins && typeof saved.editedBasePins === "object"
          ? saved.editedBasePins
          : {},
      seenByPin:
        saved.seenByPin && typeof saved.seenByPin === "object" ? saved.seenByPin : {}
    };
  } catch {
    return { userPins: [], editedBasePins: {}, seenByPin: {} };
  }
}

function savePinState(pinState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pinState));
}

function loadRouteState() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY) || "{}");
    return {
      home: saved.home && Number.isFinite(saved.home.lat) && Number.isFinite(saved.home.lng)
        ? saved.home
        : null,
      savedRoutes: Array.isArray(saved.savedRoutes) ? saved.savedRoutes : []
    };
  } catch {
    return { home: null, savedRoutes: [] };
  }
}

function saveRouteState(routeState) {
  localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(routeState));
}

function createUserPinId(kind) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${kind}-${crypto.randomUUID()}`;
  }

  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatRouteDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatWalkingDuration(meters) {
  const minutes = Math.max(1, Math.round(meters / 75));
  return minutes < 60 ? `約${minutes}分` : `約${Math.floor(minutes / 60)}時間${minutes % 60}分`;
}

function distanceToRouteMeters(pin, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [startLng, startLat] = coordinates[index - 1];
    const [endLng, endLat] = coordinates[index];
    const middleLat = ((startLat + endLat + pin.lat) / 3) * (Math.PI / 180);
    const lngScale = 111320 * Math.cos(middleLat);
    const latScale = 111320;
    const segmentX = (endLng - startLng) * lngScale;
    const segmentY = (endLat - startLat) * latScale;
    const pointX = (pin.lng - startLng) * lngScale;
    const pointY = (pin.lat - startLat) * latScale;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    const ratio = lengthSquared > 0
      ? Math.min(1, Math.max(0, (pointX * segmentX + pointY * segmentY) / lengthSquared))
      : 0;
    minimum = Math.min(
      minimum,
      Math.hypot(pointX - segmentX * ratio, pointY - segmentY * ratio)
    );
  }
  return minimum;
}

function calculateLineDistance(points) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const middleLat = ((previous.lat + point.lat) / 2) * (Math.PI / 180);
    const x = (point.lng - previous.lng) * 111320 * Math.cos(middleLat);
    const y = (point.lat - previous.lat) * 111320;
    return total + Math.hypot(x, y);
  }, 0);
}

function sampleTracePoints(points, maximum = 80) {
  if (points.length <= maximum) {
    return points;
  }
  return Array.from({ length: maximum }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (maximum - 1));
    return points[sourceIndex];
  });
}

async function fetchSuggestedRoutes(points, includeAlternatives = true) {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const params = new URLSearchParams({
    alternatives: includeAlternatives ? "3" : "false",
    geometries: "geojson",
    overview: "full",
    steps: "false"
  });
  const response = await fetch(`${ROUTE_API_URL}/${coordinates}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("ルートを取得できませんでした。時間をおいて再度お試しください。");
  }

  const data = await response.json();
  if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error("この地点間を結ぶルートが見つかりませんでした。");
  }

  return data.routes.slice(0, 3).map((route, index) => ({
    id: `route-${Date.now()}-${index}`,
    coordinates: route.geometry?.coordinates || [],
    distance: route.distance || 0,
    duration: route.duration || 0
  }));
}

async function fetchMatchedRoute(points) {
  const sampledPoints = sampleTracePoints(points);
  const coordinates = sampledPoints.map((point) => `${point.lng},${point.lat}`).join(";");
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "false",
    tidy: "true",
    radiuses: sampledPoints.map(() => "55").join(";")
  });
  const response = await fetch(`${MATCH_API_URL}/${coordinates}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("描いたラインを道路へ補正できませんでした。");
  }

  const data = await response.json();
  if (data.code !== "Ok" || !Array.isArray(data.matchings) || data.matchings.length === 0) {
    throw new Error("描いたラインに近い道路が見つかりませんでした。");
  }

  const matching = [...data.matchings].sort(
    (first, second) => (second.confidence || 0) - (first.confidence || 0)
  )[0];
  return {
    id: `drawn-route-${Date.now()}`,
    label: "手描き予測",
    coordinates: matching.geometry?.coordinates || [],
    distance: matching.distance || calculateLineDistance(sampledPoints),
    duration: matching.duration || 0,
    confidence: matching.confidence
  };
}

async function predictDrawnRoutes(home, drawnPoints) {
  const trace = sampleTracePoints([home, ...drawnPoints], 80);
  const goal = trace[trace.length - 1];
  const fallbackWaypoints = sampleTracePoints(trace, 10);
  const [matchedResult, suggestedResult] = await Promise.allSettled([
    fetchMatchedRoute(trace),
    fetchSuggestedRoutes([home, goal], true)
  ]);

  const routes = [];
  if (matchedResult.status === "fulfilled" && matchedResult.value.coordinates.length > 1) {
    routes.push(matchedResult.value);
  } else {
    try {
      const [fallbackRoute] = await fetchSuggestedRoutes(fallbackWaypoints, false);
      routes.push({ ...fallbackRoute, id: `drawn-fallback-${Date.now()}`, label: "手描き予測" });
    } catch {
      routes.push({
        id: `raw-drawn-${Date.now()}`,
        label: "描いたライン",
        coordinates: trace.map((point) => [point.lng, point.lat]),
        distance: calculateLineDistance(trace),
        duration: 0,
        isRawDrawing: true
      });
    }
  }

  if (suggestedResult.status === "fulfilled") {
    suggestedResult.value.forEach((route, index) => {
      routes.push({ ...route, id: `drawn-suggestion-${Date.now()}-${index}`, label: `候補 ${index + 1}` });
    });
  }

  return { goal, routes: routes.slice(0, 3) };
}

function buildWeatherUrl() {
  const params = new URLSearchParams({
    latitude: String(KAMIYAMA_CENTER.lat),
    longitude: String(KAMIYAMA_CENTER.lng),
    timezone: "Asia/Tokyo",
    current: ["temperature_2m", "weather_code", "is_day"].join(",")
  });

  return `${WEATHER_API_URL}?${params.toString()}`;
}

async function fetchCurrentWeather() {
  const response = await fetch(buildWeatherUrl());
  if (!response.ok) {
    throw new Error("天気情報を取得できませんでした。");
  }

  const data = await response.json();
  const weatherCode = data.current?.weather_code;

  return {
    code: weatherCode,
    label: WEATHER_LABELS[weatherCode] || "天気情報なし",
    temperature: data.current?.temperature_2m,
    time: data.current?.time,
    isDay: data.current?.is_day
  };
}

async function fetchOpenDataPins() {
  const response = await fetch(OPEN_DATA_URL);
  if (!response.ok) {
    throw new Error("オープンデータを取得できませんでした。");
  }

  const data = await response.json();
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("オープンデータの形式が正しくありません。");
  }

  const colorByCategory = Object.fromEntries(
    Object.entries(PIN_COLORS).map(([key, color]) => [color.label, key])
  );

  return data.features.flatMap((feature, index) => {
    const coordinates = feature?.geometry?.coordinates;
    if (
      feature?.geometry?.type !== "Point" ||
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      !Number.isFinite(Number(coordinates[0])) ||
      !Number.isFinite(Number(coordinates[1]))
    ) {
      return [];
    }

    const categories = String(feature.properties?.["分類"] || "その他")
      .split(/[,、]/)
      .map((category) => category.trim())
      .filter(Boolean);
    const title = String(feature.properties?.["場所"] || `オープンデータ地点 ${index + 1}`);
    const categoryText = categories.length > 0 ? categories.join("・") : "その他";
    const sourceDetail = String(feature.properties?.["詳細"] || "").trim();
    const note = String(feature.properties?.["備考"] || "").trim();
    const dangerText = String(feature.properties?.["危険度"] || "");
    const dangerLevel = Math.min(3, Math.max(1, dangerText.match(/★/g)?.length || 1));
    const detail = [
      sourceDetail || "詳細情報はありません。",
      `分類: ${categoryText}`,
      note ? `備考: ${note}` : ""
    ].filter(Boolean).join(" ");

    return [{
      id: `open-data-progq205-3-${index}`,
      lat: Number(coordinates[1]),
      lng: Number(coordinates[0]),
      title,
      detail,
      color: categories.map((category) => colorByCategory[category]).find(Boolean) || "gray",
      dangerLevel,
      kind: "hazard",
      image: HAZARD_PLACEHOLDER_IMAGE,
      source: "オープンデータ: progq205-3.geojson",
      isExternalOpenData: true
    }];
  });
}

function formatClock(date) {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildTiles(center, zoom, width, height) {
  const tileZoom = getTileZoom(zoom);
  const tileScale = 2 ** (zoom - tileZoom);
  const centerPoint = latLngToPoint(center.lat, center.lng, tileZoom);
  const visibleWidth = width / tileScale;
  const visibleHeight = height / tileScale;
  const startX = Math.floor((centerPoint.x - visibleWidth / 2) / TILE_SIZE);
  const endX = Math.floor((centerPoint.x + visibleWidth / 2) / TILE_SIZE);
  const startY = Math.floor((centerPoint.y - visibleHeight / 2) / TILE_SIZE);
  const endY = Math.floor((centerPoint.y + visibleHeight / 2) / TILE_SIZE);
  const count = 2 ** tileZoom;
  const tiles = [];

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= count) {
        continue;
      }

      const wrappedX = ((x % count) + count) % count;
      tiles.push({
        key: `${tileZoom}-${x}-${y}`,
        url: `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${y}.png`,
        left: (x * TILE_SIZE - centerPoint.x) * tileScale + width / 2,
        top: (y * TILE_SIZE - centerPoint.y) * tileScale + height / 2,
        size: TILE_SIZE * tileScale
      });
    }
  }

  return tiles;
}

function spreadCoincidentMarkers(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key = `${item.pin.lat.toFixed(6)}-${item.pin.lng.toFixed(6)}-${item.pin.kind}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });

  return items.map((item) => {
    const key = `${item.pin.lat.toFixed(6)}-${item.pin.lng.toFixed(6)}-${item.pin.kind}`;
    const group = groups.get(key) || [];
    if (group.length < 2) {
      return item;
    }

    const index = group.findIndex((entry) => entry.pin.id === item.pin.id);
    const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
    const radius = Math.min(22, 10 + group.length * 2);
    return {
      ...item,
      position: {
        x: item.position.x + Math.cos(angle) * radius,
        y: item.position.y + Math.sin(angle) * radius
      }
    };
  });
}

function separateMarkerKinds(results) {
  return results.map((result) => {
    const kind = result.type === "cluster" ? result.cluster.kind : result.pin.kind;
    const position =
      result.type === "cluster" ? result.cluster : result.position;
    const overlapsOtherKind = results.some((candidate) => {
      const candidateKind =
        candidate.type === "cluster" ? candidate.cluster.kind : candidate.pin.kind;
      const candidatePosition =
        candidate.type === "cluster" ? candidate.cluster : candidate.position;
      return (
        candidate.key !== result.key &&
        candidateKind !== kind &&
        Math.hypot(candidatePosition.x - position.x, candidatePosition.y - position.y) < 46
      );
    });

    if (!overlapsOtherKind) {
      return result;
    }

    const offsetX = kind === "vending" ? 28 : -28;
    if (result.type === "cluster") {
      return { ...result, cluster: { ...result.cluster, x: result.cluster.x + offsetX } };
    }

    return {
      ...result,
      position: { ...result.position, x: result.position.x + offsetX }
    };
  });
}

function buildMarkerGroups(items, zoom) {
  if (zoom > CLUSTER_MAX_ZOOM) {
    return separateMarkerKinds(
      spreadCoincidentMarkers(items).map((item) => ({
        type: "marker",
        key: item.pin.id,
        ...item
      }))
    );
  }

  const clusters = [];
  items.forEach((item) => {
    const kind = item.pin.kind === "vending" ? "vending" : "hazard";
    const cluster = clusters.find((candidate) => {
      if (candidate.kind !== kind) {
        return false;
      }
      return Math.hypot(candidate.x - item.position.x, candidate.y - item.position.y) <= CLUSTER_RADIUS;
    });

    if (!cluster) {
      clusters.push({
        kind,
        items: [item],
        x: item.position.x,
        y: item.position.y,
        lat: item.pin.lat,
        lng: item.pin.lng
      });
      return;
    }

    cluster.items.push(item);
    const count = cluster.items.length;
    cluster.x = (cluster.x * (count - 1) + item.position.x) / count;
    cluster.y = (cluster.y * (count - 1) + item.position.y) / count;
    cluster.lat = (cluster.lat * (count - 1) + item.pin.lat) / count;
    cluster.lng = (cluster.lng * (count - 1) + item.pin.lng) / count;
  });

  return separateMarkerKinds(clusters.map((cluster) => {
    if (cluster.items.length === 1) {
      const [item] = cluster.items;
      return { type: "marker", key: item.pin.id, ...item };
    }

    return {
      type: "cluster",
      key: `${cluster.kind}-${cluster.items.map((item) => item.pin.id).sort().join("-")}`,
      cluster
    };
  }));
}

function ClusterMarker({ cluster, onSelect }) {
  const label = cluster.kind === "vending" ? "自販機" : "危険ピン";
  return (
    <button
      type="button"
      className={`cluster-marker ${cluster.kind}`}
      style={{ left: cluster.x, top: cluster.y }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(cluster);
      }}
      onPointerDown={stopMapEvent}
      onPointerUp={stopMapEvent}
      aria-label={`${label}${cluster.items.length}件を拡大表示`}
    >
      <span>{cluster.items.length}</span>
    </button>
  );
}

function PlacementPreview({ kind, position, isFixed }) {
  const isVending = kind === "vending";
  const isRoutePoint = kind === "home" || kind === "goal" || kind === "waypoint";
  return (
    <div
      className={`placement-preview ${isVending ? "vending" : isRoutePoint ? kind : "hazard"} ${isFixed ? "is-fixed" : ""}`}
      style={{ left: position.x, top: position.y }}
      aria-hidden="true"
    >
      {isVending ? (
        <span className="vending-marker-ring">
          <span className="vending-machine-graphic">
            <i className="vending-products" />
            <i className="vending-slot" />
          </span>
        </span>
      ) : isRoutePoint ? (
        <span className="route-placement-pin" />
      ) : (
        <span className="placement-pin-shape" />
      )}
    </div>
  );
}

function RoutePointMarker({ kind, position, label }) {
  return (
    <div
      className={`route-point-marker ${kind}`}
      style={{ left: position.x, top: position.y }}
      role="img"
      aria-label={label}
      title={label}
    >
      {kind === "waypoint" ? <span>{label}</span> : null}
    </div>
  );
}

function RouteLayer({ routes, activeIndex, drawnPoints, projectPoint }) {
  if (!routes.length && drawnPoints.length < 2) {
    return null;
  }

  return (
    <svg className="route-layer" aria-hidden="true">
      {drawnPoints.length > 1 ? (
        <polyline
          className="drawn-trace"
          points={drawnPoints
            .map((point) => projectPoint(point))
            .map((point) => `${point.x},${point.y}`)
            .join(" ")}
        />
      ) : null}
      {routes.map((route, index) => {
        const points = route.coordinates
          .map(([lng, lat]) => projectPoint({ lat, lng }))
          .map((point) => `${point.x},${point.y}`)
          .join(" ");
        return (
          <polyline
            key={route.id}
            className={index === activeIndex ? "is-active" : ""}
            points={points}
          />
        );
      })}
    </svg>
  );
}

function PinMarker({ pin, position, isSelected, canEdit, onSelect, onEdit }) {
  const color = PIN_COLORS[pin.color] || PIN_COLORS.red;
  const isVending = pin.kind === "vending";

  return (
    <button
      type="button"
      className={`${isVending ? "vending-marker" : "pin-marker"} ${isSelected ? "is-selected" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        "--pin-color": color.value
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(pin);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!canEdit) {
          return;
        }
        onEdit?.(pin);
      }}
      aria-label={`${pin.title}を表示`}
    >
      {isVending ? (
        <span className="vending-marker-ring">
          <span className="vending-machine-graphic">
            <i className="vending-products" />
            <i className="vending-slot" />
          </span>
        </span>
      ) : (
        <span />
      )}
    </button>
  );
}

function stopMapEvent(event) {
  event.stopPropagation();
}

function PinInfoBubble({
  pin,
  position,
  canEdit,
  canAddHere,
  reaction,
  onAddHere,
  onCancelSeen,
  onClose,
  onEdit,
  onSeen
}) {
  if (!pin || !position) {
    return null;
  }

  const canReact = pin.kind !== "vending" && (pin.color === "blue" || pin.color === "yellow");
  const now = Date.now();
  const lastSeenAt = reaction?.lastSeenAt || 0;
  const remainingMs = Math.max(0, SEEN_COOLDOWN_MS - (now - lastSeenAt));
  const isCooldown = remainingMs > 0;
  const seenCount = reaction?.count || 0;
  const userSeenCount = reaction?.userCount || 0;
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const category = PIN_COLORS[pin.color] || PIN_COLORS.gray;

  return (
    <aside
      className={`pin-info-bubble ${position.isBelow ? "is-below" : ""}`}
      style={{ left: position.x, top: position.y }}
      onClick={stopMapEvent}
      onPointerDown={stopMapEvent}
      onPointerUp={stopMapEvent}
    >
      <img src={pin.image} alt={pin.title} className="tab-photo" />
      <div className="tab-content">
        <div className="tab-title-row">
          <div>
            <p className="panel-kicker">{pin.source || "追加データ"}</p>
            <h2>{pin.title}</h2>
          </div>
          <button
            type="button"
            className="icon-button flat"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            onPointerDown={stopMapEvent}
            onPointerUp={stopMapEvent}
            aria-label="閉じる"
          >
            x
          </button>
        </div>
        {pin.kind !== "vending" ? (
          <div className="pin-meta-row">
            <span className="category-badge">
              <i style={{ "--pin-color": category.value }} />
              {category.label}
            </span>
            <span className="danger-badge" aria-label={`危険度${pin.dangerLevel || 1}`}>
              危険度 {DANGER_LEVELS[pin.dangerLevel || 1]}
            </span>
          </div>
        ) : null}
        <p>{pin.detail}</p>
        {canReact ? (
          <div className="seen-actions">
            <button
              type="button"
              className="seen-button"
              onClick={(event) => {
                event.stopPropagation();
                onSeen(pin.id);
              }}
              disabled={isCooldown}
            >
              みました！
            </button>
            <span className="seen-count">{seenCount}回</span>
            {userSeenCount > 0 ? (
              <button
                type="button"
                className="cancel-seen-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelSeen(pin.id);
                }}
              >
                キャンセル
              </button>
            ) : null}
            {isCooldown ? <span className="cooldown-label">あと{remainingMinutes}分</span> : null}
          </div>
        ) : null}
        {canEdit || canAddHere ? (
          <div className="tab-actions">
            {canEdit ? (
              <button
                type="button"
                className="tab-edit-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(pin);
                }}
                onPointerDown={stopMapEvent}
                onPointerUp={stopMapEvent}
              >
                詳細を編集
              </button>
            ) : null}
            {canAddHere ? (
              <button
                type="button"
                className="tab-add-here-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddHere(pin);
                }}
                onPointerDown={stopMapEvent}
                onPointerUp={stopMapEvent}
              >
                ここにピンを追加
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function EmptySidePanel({ mode, hasFixedPoint }) {
  const isPinMode = mode === "hazard";
  const isVendingMode = mode === "vending";
  const isAddMode = isPinMode || isVendingMode;

  return (
    <aside className="side-hint">
      <div className={`mode-status ${isAddMode ? "is-active" : ""} ${isVendingMode ? "is-vending" : ""}`} aria-hidden="true" />
      <div>
        <p className="panel-kicker">
          {isVendingMode ? "自販機追加モード" : isPinMode ? "危険ピン追加モード" : "閲覧モード"}
        </p>
        <h2>{isVendingMode ? "自販機の追加・編集" : isPinMode ? "危険地点の追加・編集" : "危険箇所を確認"}</h2>
        <p>
          {isAddMode
            ? hasFixedPoint
              ? "追加位置を固定済み"
              : "追加位置を選択中"
            : "マーカーを選ぶと詳細を表示します。"}
        </p>
      </div>
    </aside>
  );
}

function PinForm({ draft, pin, mode = "add", onCancel, onSubmit }) {
  const isEdit = mode === "edit";
  const kind = pin?.kind || draft?.kind || "hazard";
  const isVending = kind === "vending";
  const [form, setForm] = useState({
    title: pin?.title || (isVending ? "自動販売機" : ""),
    detail: pin?.detail || "",
    color: pin?.color || (isVending ? "blue" : "red"),
    dangerLevel: pin?.dangerLevel || 1,
    image: pin?.image || ""
  });
  const [preview, setPreview] = useState(pin?.image || "");
  const coordinates = draft || pin;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setPreview(value);
      updateField("image", value);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      ...form,
      title: form.title.trim(),
      detail:
        form.detail.trim() ||
        (isVending ? "飲料を購入できる自動販売機です。" : "現地で確認された注意地点です。"),
      kind,
      image:
        form.image ||
        preview ||
        pin?.image ||
        (isVending ? VENDING_PLACEHOLDER_IMAGE : HAZARD_PLACEHOLDER_IMAGE)
    });
  }

  return (
    <form className="add-panel" onSubmit={handleSubmit}>
      <div className="panel-title-row">
        <div>
          <p className="panel-kicker">
            {isEdit ? (isVending ? "自販機編集" : "ピン編集") : isVending ? "新しい自販機" : "新しいピン"}
          </p>
          <h2>{isEdit ? "詳細情報を編集" : isVending ? "自販機を追加" : "危険地点を追加"}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="閉じる">
          x
        </button>
      </div>

      <div className="coord-chip">
        {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
      </div>

      <label>
        <span>名称</span>
        <input
          type="text"
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder={isVending ? "例: 飲料自動販売機" : "例: 見通しの悪い交差点"}
          required
        />
      </label>

      <label>
        <span>{isVending ? "詳細（任意）" : "詳細"}</span>
        <textarea
          value={form.detail}
          onChange={(event) => updateField("detail", event.target.value)}
          placeholder={isVending ? "設置場所や利用できる時間など" : "現地で確認した危険や注意点"}
          required={!isVending}
        />
      </label>

      {!isVending ? (
        <div className="select-row">
          <label>
            <span>色・分類</span>
            <div className="select-with-swatch">
              <i
                className="classification-swatch"
                style={{ "--pin-color": (PIN_COLORS[form.color] || PIN_COLORS.gray).value }}
                aria-hidden="true"
              />
              <select
                value={form.color}
                onChange={(event) => updateField("color", event.target.value)}
              >
                {Object.entries(PIN_COLORS).map(([key, color]) => (
                  <option key={key} value={key}>
                    {color.dot} {color.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label>
            <span>危険度</span>
            <select
              value={form.dangerLevel}
              onChange={(event) => updateField("dangerLevel", Number(event.target.value))}
            >
              {Object.entries(DANGER_LEVELS).map(([level, stars]) => (
                <option key={level} value={level}>
                  {stars}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <label>
        <span>画像</span>
        <input type="file" accept="image/*" onChange={handleImage} />
      </label>

      {preview ? <img src={preview} alt="画像プレビュー" className="form-preview" /> : null}

      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="primary-button">
          {isEdit ? "変更を保存" : isVending ? "自販機を追加" : "ピンを追加"}
        </button>
      </div>
    </form>
  );
}

function DataAddForm({ onCancel, onSubmit }) {
  const [form, setForm] = useState({
    title: "",
    lat: String(KAMIYAMA_CENTER.lat),
    lng: String(KAMIYAMA_CENTER.lng),
    detail: "",
    color: "red",
    dangerLevel: 1
  });
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError("緯度は-90〜90の範囲で入力してください。");
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("経度は-180〜180の範囲で入力してください。");
      return;
    }

    onSubmit({
      ...form,
      title: form.title.trim(),
      detail: form.detail.trim() || "入力データから追加された注意地点です。",
      lat,
      lng,
      dangerLevel: Number(form.dangerLevel) || 1
    });
  }

  return (
    <form className="add-panel data-add-panel" onSubmit={handleSubmit}>
      <div className="panel-title-row">
        <div>
          <p className="panel-kicker">座標データ入力</p>
          <h2>データからピンを追加</h2>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="閉じる">
          x
        </button>
      </div>

      <label>
        <span>名称</span>
        <input
          type="text"
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="例: 見通しの悪い交差点"
          required
        />
      </label>

      <div className="coordinate-inputs">
        <label>
          <span>緯度</span>
          <input
            type="number"
            value={form.lat}
            onChange={(event) => updateField("lat", event.target.value)}
            step="any"
            inputMode="decimal"
            required
          />
        </label>
        <label>
          <span>経度</span>
          <input
            type="number"
            value={form.lng}
            onChange={(event) => updateField("lng", event.target.value)}
            step="any"
            inputMode="decimal"
            required
          />
        </label>
      </div>

      <div className="select-row">
        <label>
          <span>色・分類</span>
          <div className="select-with-swatch">
            <i
              className="classification-swatch"
              style={{ "--pin-color": (PIN_COLORS[form.color] || PIN_COLORS.gray).value }}
              aria-hidden="true"
            />
            <select value={form.color} onChange={(event) => updateField("color", event.target.value)}>
              {Object.entries(PIN_COLORS).map(([key, color]) => (
                <option key={key} value={key}>{color.dot} {color.label}</option>
              ))}
            </select>
          </div>
        </label>
        <label>
          <span>危険度</span>
          <select
            value={form.dangerLevel}
            onChange={(event) => updateField("dangerLevel", Number(event.target.value))}
          >
            {Object.entries(DANGER_LEVELS).map(([level, stars]) => (
              <option key={level} value={level}>{stars}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>詳細</span>
        <textarea
          value={form.detail}
          onChange={(event) => updateField("detail", event.target.value)}
          placeholder="危険な状況や注意点"
        />
      </label>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>キャンセル</button>
        <button type="submit" className="primary-button">データを追加</button>
      </div>
    </form>
  );
}

function RoutePanel({
  activeIndex,
  error,
  goal,
  hazardCount,
  home,
  isAddingWaypoint,
  isDrawingRoute,
  loading,
  onAddGoal,
  onAddHome,
  onAddWaypoint,
  onClearWaypoints,
  onClearDrawing,
  onClose,
  onDeleteSaved,
  onLoadSaved,
  onSave,
  onSelectRoute,
  onStartDrawing,
  onToggleRouteOnly,
  routeOnly,
  routes,
  savedRoutes,
  waypoints,
  drawnPointCount
}) {
  const [routeName, setRouteName] = useState("");
  const activeRoute = routes[activeIndex] || null;

  return (
    <aside className="route-panel">
      <div className="panel-title-row">
        <div>
          <p className="panel-kicker">SAFE ROUTE</p>
          <h2>通学ルート</h2>
        </div>
        <button type="button" className="icon-button flat" onClick={onClose} aria-label="ルート表示を閉じる">x</button>
      </div>

      {!home ? (
        <div className="route-empty-state">
          <p>最初に自宅の位置を設定してください。</p>
          <button type="button" className="route-action-button home" onClick={onAddHome}>
            <i aria-hidden="true" /> 自宅を地図で設定
          </button>
        </div>
      ) : !goal ? (
        <div className="route-empty-state">
          <p>{isDrawingRoute ? "地図上を自宅からゴールまでドラッグしてください。" : "ゴールを置くか、通りたい道をラインで描きます。"}</p>
          {loading ? <p className="route-message">描いたラインからルートを予測しています...</p> : null}
          {error ? <p className="route-error" role="status">{error}</p> : null}
          <div className="route-build-actions">
            <button type="button" className="route-action-button goal" onClick={onAddGoal}>
              <i aria-hidden="true" /> ゴールを設定
            </button>
            <button
              type="button"
              className={`route-action-button draw ${isDrawingRoute ? "is-active" : ""}`}
              onClick={onStartDrawing}
            >
              <span aria-hidden="true">⌁</span> {isDrawingRoute ? "描画中" : "ラインを描く"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {loading ? <p className="route-message">ルートを探索しています...</p> : null}
          {error ? <p className="route-error" role="status">{error}</p> : null}

          {routes.length ? (
            <div className="route-candidates" aria-label="ルート候補">
              {routes.map((route, index) => (
                <button
                  key={route.id}
                  type="button"
                  className={index === activeIndex ? "is-active" : ""}
                  onClick={() => onSelectRoute(index)}
                >
                  <strong>{route.label || (waypoints.length ? "マイルート案" : `候補 ${index + 1}`)}</strong>
                  <span>{formatRouteDistance(route.distance)}・徒歩目安 {formatWalkingDuration(route.distance)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {activeRoute ? (
            <label className="route-filter-toggle">
              <input type="checkbox" checked={routeOnly} onChange={(event) => onToggleRouteOnly(event.target.checked)} />
              <span>ルート付近の危険ピンのみ表示</span>
              <small>{hazardCount}件</small>
            </label>
          ) : null}

          <div className="route-build-actions">
            <button
              type="button"
              className={`secondary-button ${isAddingWaypoint ? "is-active" : ""}`}
              onClick={onAddWaypoint}
            >
              {isAddingWaypoint ? "地図をタップ" : "経由地を追加"}
            </button>
            {waypoints.length ? (
              <button type="button" className="text-button" onClick={onClearWaypoints}>経由地を消す</button>
            ) : null}
            <button
              type="button"
              className={`secondary-button draw-route-button ${isDrawingRoute ? "is-active" : ""}`}
              onClick={onStartDrawing}
            >
              <span aria-hidden="true">⌁</span> {isDrawingRoute ? "地図上をドラッグ" : "ラインを描く"}
            </button>
            {drawnPointCount > 1 ? (
              <button type="button" className="text-button" onClick={onClearDrawing}>ラインを消す</button>
            ) : null}
          </div>

          {activeRoute ? (
            <div className="route-save-row">
              <input
                type="text"
                value={routeName}
                onChange={(event) => setRouteName(event.target.value)}
                placeholder={`マイルート ${savedRoutes.length + 1}`}
                aria-label="保存するルート名"
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onSave(routeName.trim() || `マイルート ${savedRoutes.length + 1}`);
                  setRouteName("");
                }}
              >
                保存
              </button>
            </div>
          ) : null}
        </>
      )}

      <div className="saved-routes">
        <div className="saved-routes-heading">
          <strong>マイルート</strong>
          <span>{savedRoutes.length}件</span>
        </div>
        {savedRoutes.length ? savedRoutes.map((route) => (
          <div className="saved-route-item" key={route.id}>
            <button type="button" onClick={() => onLoadSaved(route)}>
              <strong>{route.name}</strong>
              <small>{formatRouteDistance(route.route.distance)}</small>
            </button>
            <button type="button" className="saved-route-delete" onClick={() => onDeleteSaved(route.id)} aria-label={`${route.name}を削除`}>x</button>
          </div>
        )) : <p className="saved-routes-empty">保存したルートはありません。</p>}
      </div>
    </aside>
  );
}

export default function App() {
  const mapRef = useRef(null);
  const routeRequestRef = useRef(0);
  const drawRef = useRef({ pointerId: null, points: [], lastClientPoint: null });
  const gestureRef = useRef({
    clickSuppressed: false,
    lastPoint: null,
    pointers: new Map(),
    startCenterPoint: null,
    startDistance: 0,
    startMidpoint: null,
    startZoom: 14
  });
  const [center, setCenter] = useState(KAMIYAMA_CENTER);
  const [zoom, setZoom] = useState(14);
  const [mapSize, setMapSize] = useState({ width: 980, height: 620 });
  const [pinState, setPinState] = useState(() => loadPinState());
  const [selectedId, setSelectedId] = useState("");
  const [activeTabId, setActiveTabId] = useState("");
  const [hoverPoint, setHoverPoint] = useState(null);
  const [fixedPoint, setFixedPoint] = useState(null);
  const [draftPoint, setDraftPoint] = useState(null);
  const [editingPin, setEditingPin] = useState(null);
  const [addMode, setAddMode] = useState("");
  const [isDataAddOpen, setIsDataAddOpen] = useState(false);
  const [sortColor, setSortColor] = useState("all");
  const [routeState, setRouteState] = useState(() => loadRouteState());
  const [routePlacementMode, setRoutePlacementMode] = useState("");
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState(false);
  const [goalLocation, setGoalLocation] = useState(null);
  const [routeCandidates, setRouteCandidates] = useState([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [customWaypoints, setCustomWaypoints] = useState([]);
  const [drawnRoutePoints, setDrawnRoutePoints] = useState([]);
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [routeOnly, setRouteOnly] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [openDataPins, setOpenDataPins] = useState([]);
  const [openDataError, setOpenDataError] = useState("");

  const pins = useMemo(() => {
    const basePins = INITIAL_PINS.map((pin) => pinState.editedBasePins[pin.id] || pin);
    return [...basePins, ...openDataPins, ...pinState.userPins].map(normalizePin);
  }, [pinState, openDataPins]);
  const activeRoute = routeCandidates[activeRouteIndex] || null;
  const filteredPins = useMemo(
    () => pins.filter((pin) => {
      if (!pinMatchesFilter(pin, sortColor)) {
        return false;
      }
      if (!routeOnly || !activeRoute) {
        return true;
      }
      return pin.kind === "hazard" &&
        distanceToRouteMeters(pin, activeRoute.coordinates) <= ROUTE_HAZARD_DISTANCE_METERS;
    }),
    [pins, sortColor, routeOnly, activeRoute]
  );
  const selectedPin = pins.find((pin) => pin.id === selectedId) || null;
  const activeTabPin = pins.find((pin) => pin.id === activeTabId) || null;
  const isPinMode = addMode === "hazard";
  const isVendingMode = addMode === "vending";
  const isAddMode = Boolean(addMode);
  const isMapPlacementMode = isAddMode || Boolean(routePlacementMode);
  const placementKind = routePlacementMode || addMode;
  const centerPoint = latLngToPoint(center.lat, center.lng, zoom);
  const tiles = buildTiles(center, zoom, mapSize.width, mapSize.height);
  const isNightMode =
    weather?.isDay === 0 || currentTime.getHours() >= 18 || currentTime.getHours() < 6;

  const pinPositions = useMemo(() => {
    return filteredPins.map((pin) => {
      const point = latLngToPoint(pin.lat, pin.lng, zoom);
      return {
        pin,
        position: {
          x: point.x - centerPoint.x + mapSize.width / 2,
          y: point.y - centerPoint.y + mapSize.height / 2
        }
      };
    });
  }, [filteredPins, zoom, centerPoint.x, centerPoint.y, mapSize.width, mapSize.height]);
  const infoBubblePosition = useMemo(() => {
    if (!activeTabPin) return null;

    const activePosition = pinPositions.find(({ pin }) => pin.id === activeTabPin.id)?.position;
    if (
      !activePosition ||
      activePosition.x < 0 ||
      activePosition.x > mapSize.width ||
      activePosition.y < 0 ||
      activePosition.y > mapSize.height
    ) {
      return null;
    }

    const bubbleWidth = Math.min(380, Math.max(240, mapSize.width - 24));
    const halfWidth = bubbleWidth / 2;
    return {
      x: Math.min(mapSize.width - halfWidth - 12, Math.max(halfWidth + 12, activePosition.x)),
      y: activePosition.y,
      isBelow: activePosition.y < 250
    };
  }, [activeTabPin, pinPositions, mapSize.width, mapSize.height]);
  const markerGroups = useMemo(() => buildMarkerGroups(pinPositions, zoom), [pinPositions, zoom]);
  const placementPoint = fixedPoint || hoverPoint;
  const placementPosition = placementPoint
    ? (() => {
        const point = latLngToPoint(placementPoint.lat, placementPoint.lng, zoom);
        return {
          x: point.x - centerPoint.x + mapSize.width / 2,
          y: point.y - centerPoint.y + mapSize.height / 2
        };
      })()
    : null;
  const projectMapPoint = useCallback((location) => {
    const point = latLngToPoint(location.lat, location.lng, zoom);
    return {
      x: point.x - centerPoint.x + mapSize.width / 2,
      y: point.y - centerPoint.y + mapSize.height / 2
    };
  }, [zoom, centerPoint.x, centerPoint.y, mapSize.width, mapSize.height]);
  const homePosition = routeState.home ? projectMapPoint(routeState.home) : null;
  const goalPosition = goalLocation ? projectMapPoint(goalLocation) : null;
  const waypointPositions = customWaypoints.map((point, index) => ({
    position: projectMapPoint(point),
    label: String(index + 1)
  }));

  const syncMapSize = useCallback(() => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setMapSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    syncMapSize();
    window.addEventListener("resize", syncMapSize);
    return () => window.removeEventListener("resize", syncMapSize);
  }, [syncMapSize]);

  useEffect(() => {
    setHoverPoint(null);
    setFixedPoint(null);
    setDraftPoint(null);
    setEditingPin(null);
  }, [addMode]);

  useEffect(() => {
    setHoverPoint(null);
    setFixedPoint(null);
  }, [routePlacementMode]);

  useEffect(() => {
    if (activeTabPin && !pinMatchesFilter(activeTabPin, sortColor)) {
      setSelectedId("");
      setActiveTabId("");
    }
  }, [sortColor, activeTabPin]);

  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(new Date()), 30 * 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function refreshWeather() {
      try {
        const nextWeather = await fetchCurrentWeather();
        if (isActive) {
          setWeather(nextWeather);
          setWeatherError("");
        }
      } catch (error) {
        if (isActive) {
          setWeatherError(error.message);
        }
      }
    }

    refreshWeather();
    const timerId = window.setInterval(refreshWeather, WEATHER_REFRESH_MS);

    return () => {
      isActive = false;
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    fetchOpenDataPins()
      .then((nextPins) => {
        if (isActive) {
          setOpenDataPins(nextPins);
          setOpenDataError("");
        }
      })
      .catch((error) => {
        if (isActive) {
          setOpenDataError(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  function clientToMapLatLng(clientX, clientY) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    const centerWorldPoint = latLngToPoint(center.lat, center.lng, zoom);
    return pointToLatLng(
      centerWorldPoint.x + clientX - rect.left - rect.width / 2,
      centerWorldPoint.y + clientY - rect.top - rect.height / 2,
      zoom
    );
  }

  function persistRouteState(nextStateOrUpdater) {
    setRouteState((currentState) => {
      const nextState = typeof nextStateOrUpdater === "function"
        ? nextStateOrUpdater(currentState)
        : nextStateOrUpdater;
      saveRouteState(nextState);
      return nextState;
    });
  }

  async function requestRoutes(goal, waypoints = [], includeAlternatives = true) {
    if (!routeState.home || !goal) {
      return;
    }

    const requestId = routeRequestRef.current + 1;
    routeRequestRef.current = requestId;
    setIsRouteLoading(true);
    setRouteError("");
    try {
      const nextRoutes = await fetchSuggestedRoutes(
        [routeState.home, ...waypoints, goal],
        includeAlternatives
      );
      if (routeRequestRef.current !== requestId) {
        return;
      }
      setRouteCandidates(nextRoutes);
      setActiveRouteIndex(0);
      setRouteOnly(true);
    } catch (error) {
      if (routeRequestRef.current === requestId) {
        setRouteCandidates([]);
        setRouteOnly(false);
        setRouteError(error.message);
      }
    } finally {
      if (routeRequestRef.current === requestId) {
        setIsRouteLoading(false);
      }
    }
  }

  async function requestDrawnRoute(points) {
    if (!routeState.home || points.length < 2) {
      return;
    }

    const requestId = routeRequestRef.current + 1;
    routeRequestRef.current = requestId;
    setIsRouteLoading(true);
    setRouteError("");
    try {
      const prediction = await predictDrawnRoutes(routeState.home, points);
      if (routeRequestRef.current !== requestId) {
        return;
      }
      setGoalLocation(prediction.goal);
      setRouteCandidates(prediction.routes);
      setActiveRouteIndex(0);
      setRouteOnly(true);
    } catch (error) {
      if (routeRequestRef.current === requestId) {
        setRouteCandidates([]);
        setRouteOnly(false);
        setRouteError(error.message || "描いたラインからルートを予測できませんでした。");
      }
    } finally {
      if (routeRequestRef.current === requestId) {
        setIsRouteLoading(false);
      }
    }
  }

  function resetActiveRoute(closePanel = false) {
    routeRequestRef.current += 1;
    setGoalLocation(null);
    setRouteCandidates([]);
    setActiveRouteIndex(0);
    setCustomWaypoints([]);
    setDrawnRoutePoints([]);
    setIsDrawingRoute(false);
    drawRef.current = { pointerId: null, points: [], lastClientPoint: null };
    setRouteOnly(false);
    setRouteError("");
    setIsRouteLoading(false);
    setRoutePlacementMode("");
    if (closePanel) {
      setIsRoutePanelOpen(false);
    }
  }

  function handleMapClick(event) {
    if (gestureRef.current.clickSuppressed) {
      gestureRef.current.clickSuppressed = false;
      return;
    }

    if (routePlacementMode) {
      const nextPoint = clientToMapLatLng(event.clientX, event.clientY);
      if (!nextPoint) {
        return;
      }

      if (routePlacementMode === "home") {
        persistRouteState((currentState) => ({ ...currentState, home: nextPoint }));
        resetActiveRoute(false);
        setIsRoutePanelOpen(true);
      } else if (routePlacementMode === "goal") {
        setGoalLocation(nextPoint);
        setCustomWaypoints([]);
        setDrawnRoutePoints([]);
        setIsRoutePanelOpen(true);
        setRoutePlacementMode("");
        requestRoutes(nextPoint, [], true);
      } else if (routePlacementMode === "waypoint" && goalLocation) {
        const nextWaypoints = [...customWaypoints, nextPoint];
        setCustomWaypoints(nextWaypoints);
        setDrawnRoutePoints([]);
        setRoutePlacementMode("");
        requestRoutes(goalLocation, nextWaypoints, false);
      }

      setHoverPoint(null);
      setSelectedId("");
      setActiveTabId("");
      return;
    }

    if (isVendingMode && !editingPin) {
      const nextPoint = clientToMapLatLng(event.clientX, event.clientY);
      if (nextPoint) {
        setFixedPoint(nextPoint);
        setHoverPoint(nextPoint);
        setDraftPoint({ ...nextPoint, kind: "vending" });
        setSelectedId("");
        setActiveTabId("");
      }
      return;
    }

    if (isPinMode && !draftPoint && !editingPin) {
      const nextPoint = clientToMapLatLng(event.clientX, event.clientY);
      if (nextPoint) {
        setFixedPoint(nextPoint);
        setHoverPoint(nextPoint);
        setSelectedId("");
        setActiveTabId("");
      }
      return;
    }

    setSelectedId("");
    setActiveTabId("");
    setFixedPoint(null);
    setDraftPoint(null);
    setEditingPin(null);
  }

  function persistPinState(nextStateOrUpdater) {
    setPinState((currentState) => {
      const nextState =
        typeof nextStateOrUpdater === "function"
          ? nextStateOrUpdater(currentState)
          : nextStateOrUpdater;
      savePinState(nextState);
      return nextState;
    });
  }

  function addPin(form) {
    if (!draftPoint) {
      return;
    }

    const pinKind = form.kind || draftPoint.kind || "hazard";
    const nextPin = {
      id: createUserPinId(pinKind),
      lat: draftPoint.lat,
      lng: draftPoint.lng,
      title: form.title.trim(),
      detail: form.detail.trim(),
      color: form.color,
      dangerLevel: Number(form.dangerLevel) || 1,
      kind: pinKind,
      image: form.image,
      source:
        pinKind === "vending"
          ? "ユーザー追加: 自動販売機"
          : "ユーザー追加データ"
    };
    persistPinState((currentState) => ({
      ...currentState,
      userPins: [...currentState.userPins, nextPin]
    }));
    setSortColor("all");
    setSelectedId(nextPin.id);
    setActiveTabId(nextPin.id);
    setHoverPoint(null);
    setFixedPoint(null);
    setDraftPoint(null);
    setEditingPin(null);
  }

  function quickAddVending() {
    if (!draftPoint || draftPoint.kind !== "vending") {
      return;
    }

    addPin({
      title: "自動販売機",
      detail: "飲料を購入できる自動販売機です。",
      color: "blue",
      dangerLevel: 1,
      kind: "vending",
      image: VENDING_PLACEHOLDER_IMAGE
    });
  }

  function addPinFromData(form) {
    const nextPin = {
      id: createUserPinId("hazard"),
      lat: form.lat,
      lng: form.lng,
      title: form.title,
      detail: form.detail,
      color: form.color,
      dangerLevel: form.dangerLevel,
      kind: "hazard",
      image: HAZARD_PLACEHOLDER_IMAGE,
      source: "ユーザー入力: 座標データ"
    };

    persistPinState((currentState) => ({
      ...currentState,
      userPins: [...currentState.userPins, nextPin]
    }));
    setSortColor("all");
    setCenter({ lat: nextPin.lat, lng: nextPin.lng });
    setZoom((value) => Math.max(value, 15));
    setSelectedId(nextPin.id);
    setActiveTabId(nextPin.id);
    setIsDataAddOpen(false);
  }

  function editPin(form) {
    if (!editingPin) {
      return;
    }

    const editedPin = {
      ...editingPin,
      title: form.title,
      detail: form.detail,
      color: form.color,
      dangerLevel: Number(form.dangerLevel) || editingPin.dangerLevel || 1,
      kind: form.kind || editingPin.kind || "hazard",
      image: form.image,
      source: editingPin.source?.startsWith("作成データ") ? "編集済みデータ" : editingPin.source
    };

    if (INITIAL_PINS.some((pin) => pin.id === editingPin.id)) {
      persistPinState({
        ...pinState,
        editedBasePins: {
          ...pinState.editedBasePins,
          [editingPin.id]: editedPin
        }
      });
    } else {
      persistPinState({
        ...pinState,
        userPins: pinState.userPins.map((pin) => (pin.id === editingPin.id ? editedPin : pin))
      });
    }

    setSelectedId(editedPin.id);
    setActiveTabId(editedPin.id);
    setEditingPin(null);
  }

  function confirmPlacement() {
    if (!isAddMode || !fixedPoint) {
      return;
    }

    setDraftPoint({ ...fixedPoint, kind: addMode });
    setSelectedId("");
    setActiveTabId("");
    setEditingPin(null);
  }

  function startAddingAtPin(pin) {
    if (!isPinMode) {
      return;
    }

    const nextPoint = { lat: pin.lat, lng: pin.lng };
    setFixedPoint(nextPoint);
    setHoverPoint(nextPoint);
    setDraftPoint({ ...nextPoint, kind: "hazard" });
    setSelectedId("");
    setActiveTabId("");
    setEditingPin(null);
  }

  function selectCluster(cluster) {
    setCenter({ lat: cluster.lat, lng: cluster.lng });
    setZoom((value) => clampZoom(Math.max(value + 1.35, CLUSTER_MAX_ZOOM + 0.2)));
    setSelectedId("");
    setActiveTabId("");
  }

  function markSeen(pinId) {
    const current = pinState.seenByPin?.[pinId] || {};
    const now = Date.now();
    const lastSeenAt = current.lastSeenAt || 0;
    if (now - lastSeenAt < SEEN_COOLDOWN_MS) {
      return;
    }

    persistPinState({
      ...pinState,
      seenByPin: {
        ...pinState.seenByPin,
        [pinId]: {
          count: (current.count || 0) + 1,
          userCount: (current.userCount || 0) + 1,
          lastSeenAt: now
        }
      }
    });
  }

  function cancelSeen(pinId) {
    const current = pinState.seenByPin?.[pinId] || {};
    const userCount = current.userCount || 0;
    if (userCount <= 0) {
      return;
    }

    persistPinState({
      ...pinState,
      seenByPin: {
        ...pinState.seenByPin,
        [pinId]: {
          ...current,
          count: Math.max(0, (current.count || 0) - 1),
          userCount: userCount - 1
        }
      }
    });
  }

  function moveCenter(deltaX, deltaY) {
    panMap(deltaX, deltaY);
  }

  function panMap(deltaX, deltaY) {
    setCenter((currentCenter) => {
      const point = latLngToPoint(currentCenter.lat, currentCenter.lng, zoom);
      return pointToLatLng(point.x + deltaX, point.y + deltaY, zoom);
    });
  }

  function zoomMapAt(clientX, clientY, nextZoom) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const clampedZoom = clampZoom(nextZoom);
    if (clampedZoom === zoom) {
      return;
    }

    const focusX = clientX - rect.left;
    const focusY = clientY - rect.top;
    const offsetX = focusX - mapSize.width / 2;
    const offsetY = focusY - mapSize.height / 2;
    const currentPoint = latLngToPoint(center.lat, center.lng, zoom);
    const focusedPoint = {
      x: currentPoint.x + offsetX,
      y: currentPoint.y + offsetY
    };
    const zoomScale = 2 ** (clampedZoom - zoom);
    const nextFocusedPoint = {
      x: focusedPoint.x * zoomScale,
      y: focusedPoint.y * zoomScale
    };

    setCenter(
      pointToLatLng(
        nextFocusedPoint.x - offsetX,
        nextFocusedPoint.y - offsetY,
        clampedZoom
      )
    );
    setZoom(clampedZoom);
  }

  function handleWheel(event) {
    event.preventDefault();
    gestureRef.current.clickSuppressed = true;

    if (event.ctrlKey || event.metaKey) {
      const wheelDelta = Math.max(-140, Math.min(140, event.deltaY));
      zoomMapAt(event.clientX, event.clientY, zoom - wheelDelta * WHEEL_ZOOM_SENSITIVITY);
      return;
    }

    panMap(event.deltaX, event.deltaY);
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }

    if (isDrawingRoute) {
      const point = clientToMapLatLng(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      mapRef.current?.setPointerCapture?.(event.pointerId);
      drawRef.current = {
        pointerId: event.pointerId,
        points: [point],
        lastClientPoint: { x: event.clientX, y: event.clientY }
      };
      setDrawnRoutePoints([point]);
      gestureRef.current.clickSuppressed = true;
      return;
    }

    mapRef.current?.setPointerCapture?.(event.pointerId);
    const pointer = { x: event.clientX, y: event.clientY };
    gestureRef.current.pointers.set(event.pointerId, pointer);

    if (gestureRef.current.pointers.size === 1) {
      gestureRef.current.lastPoint = pointer;
      gestureRef.current.clickSuppressed = false;
      return;
    }

    if (gestureRef.current.pointers.size === 2) {
      const [first, second] = Array.from(gestureRef.current.pointers.values());
      gestureRef.current.startDistance = getTouchDistance(first, second);
      gestureRef.current.startMidpoint = getTouchMidpoint(first, second);
      gestureRef.current.startCenterPoint = latLngToPoint(center.lat, center.lng, zoom);
      gestureRef.current.startZoom = zoom;
      gestureRef.current.clickSuppressed = true;
    }
  }

  function handlePointerMove(event) {
    if (isDrawingRoute && drawRef.current.pointerId === event.pointerId) {
      const lastClientPoint = drawRef.current.lastClientPoint;
      if (
        lastClientPoint &&
        Math.hypot(event.clientX - lastClientPoint.x, event.clientY - lastClientPoint.y) < 6
      ) {
        return;
      }
      const point = clientToMapLatLng(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      const nextPoints = [...drawRef.current.points, point];
      drawRef.current.points = nextPoints;
      drawRef.current.lastClientPoint = { x: event.clientX, y: event.clientY };
      setDrawnRoutePoints(nextPoints);
      return;
    }

    if (!gestureRef.current.pointers.has(event.pointerId)) {
      if (
        event.pointerType === "mouse" &&
        isMapPlacementMode &&
        !fixedPoint &&
        !draftPoint &&
        !editingPin
      ) {
        const nextPoint = clientToMapLatLng(event.clientX, event.clientY);
        if (nextPoint) {
          setHoverPoint(nextPoint);
        }
      }
      return;
    }

    const nextPointer = { x: event.clientX, y: event.clientY };
    gestureRef.current.pointers.set(event.pointerId, nextPointer);

    if (gestureRef.current.pointers.size === 1) {
      const previousPoint = gestureRef.current.lastPoint;
      if (!previousPoint) {
        gestureRef.current.lastPoint = nextPointer;
        return;
      }

      const deltaX = nextPointer.x - previousPoint.x;
      const deltaY = nextPointer.y - previousPoint.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
        gestureRef.current.clickSuppressed = true;
        panMap(-deltaX, -deltaY);
      }
      gestureRef.current.lastPoint = nextPointer;
      return;
    }

    if (gestureRef.current.pointers.size === 2) {
      const [first, second] = Array.from(gestureRef.current.pointers.values());
      const distance = getTouchDistance(first, second);
      const midpoint = getTouchMidpoint(first, second);
      const startDistance = gestureRef.current.startDistance || distance;
      const startMidpoint = gestureRef.current.startMidpoint || midpoint;
      const startCenterPoint =
        gestureRef.current.startCenterPoint || latLngToPoint(center.lat, center.lng, zoom);
      const nextZoom = clampZoom(
        gestureRef.current.startZoom +
          Math.log2(distance / startDistance) * PINCH_ZOOM_SENSITIVITY
      );
      const zoomScale = 2 ** (nextZoom - gestureRef.current.startZoom);
      const focusedStartPoint = {
        x: startCenterPoint.x + startMidpoint.x - mapSize.width / 2,
        y: startCenterPoint.y + startMidpoint.y - mapSize.height / 2
      };
      const focusedNextPoint = {
        x: focusedStartPoint.x * zoomScale,
        y: focusedStartPoint.y * zoomScale
      };

      gestureRef.current.clickSuppressed = true;
      setCenter(
        pointToLatLng(
          focusedNextPoint.x - (midpoint.x - mapSize.width / 2),
          focusedNextPoint.y - (midpoint.y - mapSize.height / 2),
          nextZoom
        )
      );
      setZoom(nextZoom);
    }
  }

  function handlePointerEnd(event) {
    if (drawRef.current.pointerId === event.pointerId) {
      const points = drawRef.current.points;
      drawRef.current = { pointerId: null, points: [], lastClientPoint: null };
      mapRef.current?.releasePointerCapture?.(event.pointerId);
      setIsDrawingRoute(false);
      gestureRef.current.clickSuppressed = true;
      if (points.length > 1 && calculateLineDistance(points) >= 20) {
        requestDrawnRoute(points);
      } else {
        setDrawnRoutePoints([]);
        setRouteError("もう少し長くラインを描いてください。");
      }
      return;
    }

    gestureRef.current.pointers.delete(event.pointerId);
    mapRef.current?.releasePointerCapture?.(event.pointerId);

    if (gestureRef.current.pointers.size === 1) {
      const [remainingPointer] = Array.from(gestureRef.current.pointers.values());
      gestureRef.current.lastPoint = remainingPointer;
      return;
    }

    if (gestureRef.current.pointers.size === 0) {
      gestureRef.current.lastPoint = null;
      gestureRef.current.startCenterPoint = null;
      gestureRef.current.startDistance = 0;
      gestureRef.current.startMidpoint = null;
    }
  }

  function handlePointerLeave() {
    if (!fixedPoint && gestureRef.current.pointers.size === 0) {
      setHoverPoint(null);
    }
  }

  function startEditingPin(pin) {
    const pinKind = pin.kind === "vending" ? "vending" : "hazard";
    if (pin.isExternalOpenData || addMode !== pinKind) {
      return;
    }

    setSelectedId(pin.id);
    setActiveTabId(pin.id);
    setFixedPoint(null);
    setDraftPoint(null);
    setEditingPin(pin);
  }

  function selectPin(pin) {
    setSelectedId(pin.id);
    setActiveTabId(pin.id);
    setFixedPoint(null);
    setDraftPoint(null);
    setEditingPin(null);
  }

  function canEditPin(pin) {
    const pinKind = pin.kind === "vending" ? "vending" : "hazard";
    return !pin.isExternalOpenData && addMode === pinKind;
  }

  function toggleAddMode(kind) {
    const nextMode = addMode === kind ? "" : kind;
    setAddMode(nextMode);
    setRoutePlacementMode("");
    setIsDrawingRoute(false);
    setIsDataAddOpen(false);
    if (nextMode) {
      setSortColor("all");
    }
  }

  function toggleDataAdd() {
    setIsDataAddOpen((current) => !current);
    setAddMode("");
    setRoutePlacementMode("");
    setIsDrawingRoute(false);
    setHoverPoint(null);
    setFixedPoint(null);
    setDraftPoint(null);
    setEditingPin(null);
  }

  function startRoutePlacement(kind) {
    setRoutePlacementMode((current) => current === kind ? "" : kind);
    setAddMode("");
    setIsDrawingRoute(false);
    setIsDataAddOpen(false);
    setIsRoutePanelOpen(true);
    setSelectedId("");
    setActiveTabId("");
    setDraftPoint(null);
    setEditingPin(null);
  }

  function clearWaypoints() {
    setCustomWaypoints([]);
    setDrawnRoutePoints([]);
    if (goalLocation) {
      requestRoutes(goalLocation, [], true);
    }
  }

  function startDrawingRoute() {
    if (!routeState.home) {
      return;
    }
    if (isDrawingRoute) {
      setIsDrawingRoute(false);
      drawRef.current = { pointerId: null, points: [], lastClientPoint: null };
      return;
    }

    routeRequestRef.current += 1;
    setIsDrawingRoute(true);
    setRoutePlacementMode("");
    setAddMode("");
    setIsDataAddOpen(false);
    setIsRoutePanelOpen(true);
    setGoalLocation(null);
    setRouteCandidates([]);
    setActiveRouteIndex(0);
    setCustomWaypoints([]);
    setDrawnRoutePoints([]);
    setRouteOnly(false);
    setRouteError("");
    setSelectedId("");
    setActiveTabId("");
  }

  function clearDrawnRoute() {
    resetActiveRoute(false);
    setIsRoutePanelOpen(true);
  }

  function saveCurrentRoute(name) {
    if (!activeRoute || !goalLocation) {
      return;
    }
    const savedRoute = {
      id: createUserPinId("my-route"),
      name,
      goal: goalLocation,
      waypoints: customWaypoints,
      drawnPoints: drawnRoutePoints,
      route: activeRoute,
      createdAt: new Date().toISOString()
    };
    persistRouteState((currentState) => ({
      ...currentState,
      savedRoutes: [...currentState.savedRoutes, savedRoute]
    }));
  }

  function loadSavedRoute(savedRoute) {
    setGoalLocation(savedRoute.goal);
    setCustomWaypoints(Array.isArray(savedRoute.waypoints) ? savedRoute.waypoints : []);
    setDrawnRoutePoints(Array.isArray(savedRoute.drawnPoints) ? savedRoute.drawnPoints : []);
    setRouteCandidates([savedRoute.route]);
    setActiveRouteIndex(0);
    setRouteOnly(true);
    setRouteError("");
    setRoutePlacementMode("");
    setIsDrawingRoute(false);
    setIsRoutePanelOpen(true);
    setCenter(savedRoute.goal);
    setZoom((value) => Math.max(value, 14));
  }

  function deleteSavedRoute(routeId) {
    persistRouteState((currentState) => ({
      ...currentState,
      savedRoutes: currentState.savedRoutes.filter((route) => route.id !== routeId)
    }));
  }

  return (
    <main className={`app-shell ${isNightMode ? "is-dark" : ""}`}>
      <header className="top-bar">
        <div className="app-title">
          <p className="eyebrow">KAMIYAMA SAFETY MAP</p>
          <h1>神山町 通学路危険マップ</h1>
        </div>
        <div className="top-actions">
          <div className="live-status" aria-label="現在の時刻と天気">
            <span>{formatClock(currentTime)}</span>
            <span>
              {weather
                ? `${weather.label} ${Math.round(weather.temperature)}°C`
                : weatherError || "天気取得中"}
            </span>
          </div>
          <div className="mode-controls" aria-label="追加モード">
            <button
              type="button"
              className={`mode-toggle ${isPinMode ? "is-active" : ""}`}
              onClick={() => toggleAddMode("hazard")}
              aria-pressed={isPinMode}
            >
              <span className="mode-toggle-icon" aria-hidden="true">+</span>
              <span>{isPinMode ? "危険ピン ON" : "危険ピン"}</span>
            </button>
            <button
              type="button"
              className={`mode-toggle vending-mode-toggle ${isVendingMode ? "is-active" : ""}`}
              onClick={() => toggleAddMode("vending")}
              aria-pressed={isVendingMode}
            >
              <span className="vending-mode-icon" aria-hidden="true">
                <i />
              </span>
              <span>{isVendingMode ? "自販機 ON" : "自販機追加"}</span>
            </button>
            <button
              type="button"
              className={`mode-toggle data-mode-toggle ${isDataAddOpen ? "is-active" : ""}`}
              onClick={toggleDataAdd}
              aria-pressed={isDataAddOpen}
            >
              <span className="data-mode-icon" aria-hidden="true">＋</span>
              <span>データ追加</span>
            </button>
          </div>
          <div className="route-controls" aria-label="通学ルート">
            <button
              type="button"
              className={`route-mode-button home ${routePlacementMode === "home" ? "is-active" : ""}`}
              onClick={() => startRoutePlacement("home")}
              aria-pressed={routePlacementMode === "home"}
            >
              <i aria-hidden="true" />
              {routeState.home ? "自宅を変更" : "自宅を設定"}
            </button>
            <button
              type="button"
              className={`route-mode-button goal ${routePlacementMode === "goal" ? "is-active" : ""}`}
              onClick={() => startRoutePlacement("goal")}
              aria-pressed={routePlacementMode === "goal"}
              disabled={!routeState.home}
            >
              <i aria-hidden="true" />
              ゴール
            </button>
            <button
              type="button"
              className={`route-mode-button saved ${isRoutePanelOpen ? "is-active" : ""}`}
              onClick={() => {
                if (isRoutePanelOpen) {
                  resetActiveRoute(true);
                } else {
                  setIsRoutePanelOpen(true);
                }
              }}
              aria-pressed={isRoutePanelOpen}
            >
              マイルート
            </button>
          </div>
        </div>
      </header>

      <section className="map-workspace">
        <div className="map-card">
          <div className="map-toolbar" aria-label="マップ操作">
            <button type="button" className="icon-button" onClick={() => setZoom((value) => clampZoom(value + 1))} aria-label="拡大" title="拡大">
              +
            </button>
            <button type="button" className="icon-button" onClick={() => setZoom((value) => clampZoom(value - 1))} aria-label="縮小" title="縮小">
              −
            </button>
            <button type="button" className="icon-button" onClick={() => moveCenter(0, -160)} aria-label="北へ移動" title="北へ移動">
              ↑
            </button>
            <button type="button" className="icon-button" onClick={() => moveCenter(0, 160)} aria-label="南へ移動" title="南へ移動">
              ↓
            </button>
            <button type="button" className="icon-button" onClick={() => moveCenter(-160, 0)} aria-label="西へ移動" title="西へ移動">
              ←
            </button>
            <button type="button" className="icon-button" onClick={() => moveCenter(160, 0)} aria-label="東へ移動" title="東へ移動">
              →
            </button>
          </div>

          <div
            className={`map-canvas ${isMapPlacementMode ? "is-pin-mode" : ""} ${isDrawingRoute ? "is-drawing-route" : ""}`}
            ref={mapRef}
            onClick={handleMapClick}
            onPointerCancel={handlePointerEnd}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onWheel={handleWheel}
            role="application"
            aria-label="徳島県神山町の通学路危険マップ"
          >
            {tiles.map((tile) => (
              <img
                key={tile.key}
                className="map-tile"
                src={tile.url}
                alt=""
                style={{
                  left: tile.left,
                  top: tile.top,
                  width: tile.size,
                  height: tile.size
                }}
                draggable="false"
              />
            ))}

            <RouteLayer
              routes={routeCandidates}
              activeIndex={activeRouteIndex}
              drawnPoints={drawnRoutePoints}
              projectPoint={projectMapPoint}
            />

            {isMapPlacementMode && placementPosition ? (
              <PlacementPreview
                kind={placementKind}
                position={placementPosition}
                isFixed={Boolean(fixedPoint)}
              />
            ) : null}

            {isAddMode && fixedPoint && !editingPin && (isVendingMode || !draftPoint) ? (
                <button
                  type="button"
                  className={`map-add-button ${isVendingMode ? "is-vending" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isVendingMode) {
                      quickAddVending();
                    } else {
                      confirmPlacement();
                    }
                  }}
                  onPointerDown={stopMapEvent}
                  onPointerUp={stopMapEvent}
                >
                  {isVendingMode ? (
                    <span className="map-add-vending-icon" aria-hidden="true"><i /></span>
                  ) : (
                    <span aria-hidden="true">+</span>
                  )}
                  {isVendingMode ? "自販機を追加" : "ピンを追加"}
                </button>
            ) : null}

            {markerGroups.map((group) =>
              group.type === "cluster" ? (
                <ClusterMarker key={group.key} cluster={group.cluster} onSelect={selectCluster} />
              ) : (
                <PinMarker
                  key={group.key}
                  pin={group.pin}
                  position={group.position}
                  isSelected={selectedPin?.id === group.pin.id}
                  canEdit={canEditPin(group.pin)}
                  onSelect={selectPin}
                  onEdit={startEditingPin}
                />
              )
            )}

            {homePosition ? <RoutePointMarker kind="home" position={homePosition} label="自宅" /> : null}
            {goalPosition ? <RoutePointMarker kind="goal" position={goalPosition} label="ゴール" /> : null}
            {waypointPositions.map((waypoint) => (
              <RoutePointMarker
                key={waypoint.label}
                kind="waypoint"
                position={waypoint.position}
                label={waypoint.label}
              />
            ))}

            <PinInfoBubble
              pin={!draftPoint && !editingPin ? activeTabPin : null}
              position={infoBubblePosition}
              canEdit={activeTabPin ? canEditPin(activeTabPin) : false}
              canAddHere={Boolean(isPinMode && activeTabPin?.kind !== "vending")}
              reaction={activeTabPin ? pinState.seenByPin?.[activeTabPin.id] : null}
              onAddHere={startAddingAtPin}
              onCancelSeen={cancelSeen}
              onClose={() => setActiveTabId("")}
              onEdit={startEditingPin}
              onSeen={markSeen}
            />

            <div className="map-attribution">
              © OpenStreetMap contributors
            </div>
          </div>
        </div>

        <div className="side-stack">
          {isRoutePanelOpen ? (
            <RoutePanel
              activeIndex={activeRouteIndex}
              error={routeError}
              goal={goalLocation}
              hazardCount={filteredPins.filter((pin) => pin.kind === "hazard").length}
              home={routeState.home}
              isAddingWaypoint={routePlacementMode === "waypoint"}
              isDrawingRoute={isDrawingRoute}
              loading={isRouteLoading}
              onAddGoal={() => startRoutePlacement("goal")}
              onAddHome={() => startRoutePlacement("home")}
              onAddWaypoint={() => startRoutePlacement("waypoint")}
              onClearDrawing={clearDrawnRoute}
              onClearWaypoints={clearWaypoints}
              onClose={() => resetActiveRoute(true)}
              onDeleteSaved={deleteSavedRoute}
              onLoadSaved={loadSavedRoute}
              onSave={saveCurrentRoute}
              onSelectRoute={setActiveRouteIndex}
              onStartDrawing={startDrawingRoute}
              onToggleRouteOnly={setRouteOnly}
              routeOnly={routeOnly}
              routes={routeCandidates}
              savedRoutes={routeState.savedRoutes}
              waypoints={customWaypoints}
              drawnPointCount={drawnRoutePoints.length}
            />
          ) : isDataAddOpen ? (
            <DataAddForm onCancel={() => setIsDataAddOpen(false)} onSubmit={addPinFromData} />
          ) : isAddMode && draftPoint ? (
            <PinForm
              key={`add-${draftPoint.kind}`}
              draft={draftPoint}
              onCancel={() => setDraftPoint(null)}
              onSubmit={addPin}
            />
          ) : isAddMode && editingPin ? (
            <PinForm
              key={`edit-${editingPin.id}`}
              mode="edit"
              pin={editingPin}
              onCancel={() => setEditingPin(null)}
              onSubmit={editPin}
            />
          ) : (
            <EmptySidePanel mode={addMode} hasFixedPoint={Boolean(fixedPoint)} />
          )}

          <section className="pin-list">
            {openDataError ? <p className="data-error">{openDataError}</p> : null}
            <div className="panel-title-row">
              <div>
                <p className="panel-kicker">登録地点</p>
                <h2>
                  {sortColor === "all" && !routeOnly
                    ? `${pins.length}件`
                    : `${filteredPins.length}件 / 全${pins.length}件`}
                </h2>
              </div>
              <label className="sort-select">
                <span>分類で絞り込み</span>
                <select value={sortColor} onChange={(event) => setSortColor(event.target.value)}>
                  <option value="all">すべて</option>
                  {Object.entries(PIN_COLORS).map(([key, color]) => (
                    <option key={key} value={key}>{color.dot} {color.label}</option>
                  ))}
                  <option value="vending">🥤 自動販売機</option>
                </select>
              </label>
            </div>
            {filteredPins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                className={`pin-list-item ${selectedPin?.id === pin.id ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedId(pin.id);
                  setActiveTabId(pin.id);
                  setCenter({ lat: pin.lat, lng: pin.lng });
                  setHoverPoint(null);
                  setFixedPoint(null);
                  setDraftPoint(null);
                  setEditingPin(null);
                }}
                onDoubleClick={() => {
                  setCenter({ lat: pin.lat, lng: pin.lng });
                  startEditingPin(pin);
                }}
              >
                {pin.kind === "vending" ? (
                  <span className="list-vending-icon" aria-hidden="true"><i /></span>
                ) : (
                  <span
                    className="list-dot"
                    style={{ "--pin-color": (PIN_COLORS[pin.color] || PIN_COLORS.red).value }}
                  />
                )}
                <span className="pin-list-copy">
                  <strong>{pin.title}</strong>
                  <small>
                    {pin.kind === "vending"
                      ? "自販機"
                      : `${(PIN_COLORS[pin.color] || PIN_COLORS.gray).label}・${DANGER_LEVELS[pin.dangerLevel || 1]}`}
                  </small>
                </span>
              </button>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
