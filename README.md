# 神山町 通学路危険マップ「Pin」

## アプリの概要

神山町の通学路にある危険箇所、自動販売機、通学ルートを地図上で確認・登録するWebアプリです

## 主な機能

地図に立てられたピン(赤/防災、青/防犯、黄/生物、緑/交通)をタップして、危険について知ることができます　色でソートすることができます
アプリ上でカーソルを動かしてピンを立てることができます　ピンの詳細を編集すると危険度や情報を書き加えることができます
アプリ上で緯度経度を用いてピンを追加することもできます
自動販売機の位置をピンとして追加することができます
自宅の位置とゴール地点を設定すると自動でルートを提案し、そのルート付近にある危険ピンのみを表示することができます

- 初期データは `public/data/progq205-3.geojson` から読み込みます。
- 利用者が追加したピンやルートは、その利用者のブラウザ内（localStorage）に保存されます。他の利用者には自動共有されません。
- 地図タイルにはOpenStreetMap、ルート候補にはOSRM、天気情報にはOpen-Meteoを利用しています。各サービスの利用条件に従ってください。
- 写真に個人情報や児童の顔、自宅を特定できる情報を含めないよう注意してください。

## 使い方

「Deployments」→「github-pages」から実行できます。
マイルートを登録したり、危険をマップ上で見たりすることができるほか、マップにダイレクトにピンを刺したりデータからピンを追加したりすることができます。
アプリ上に表示されているピンをタップすると詳細を確認できます。
ピンクのピンで家を登録するとその地点が保存されます。白のピンを刺すと家からその地点までのルートをいくつか提案してくれます。
マイルートに登録することでいつでも見返すことができます。また、マイルートは自分で線を引くことで作成することも可能です。

### 使用したデータ
- Open street map contributors
- HTML5 / CSS3
- JavaScript（ES Modules）
- React 19.2.7
- Vite 6.4.3
- GeoJSON
- Fetch API
- Pointer Events
- Web Storage API（localStorage）
- GitHub Actions
- GitHub Pages

| ライブラリ名 | バージョン | 用途 | ライセンス |
| React | 19.2.7 | UIの構築と状態管理 | MIT License |
| React DOM | 19.2.7 | React画面のブラウザ表示 | MIT License |
| Vite | 6.4.3 | 開発サーバーと本番ビルド | MIT License |
| @vitejs/plugin-react | 5.2.0 | ViteでReactを利用するためのプラグイン | MIT License |

- `public/data/progq205-3.geojson`
  - 神山町の危険箸所を表示するためのGeoJSONデータ
  - データの作成者・提供元・再利用条件は、確認できる場合は追記してください
- [OpenStreetMap](https://www.openstreetmap.org/copyright)
  - 地図タイルの表示に使用
  - © OpenStreetMap contributors
  - Open Database License（ODbL 1.0）
- [OSRM](https://github.com/Project-OSRM/osrm-backend)
  - 自宅から目的地までのルート探索と、手描きルートの道路への補正に使用
  - OSRM BackendはBSD 2-Clause License
- [Open-Meteo](https://open-meteo.com/en/licence)
  - 神山町の天気・気温・昼夜情報の取得に使用
  - APIデータはCC BY 4.0
  - 無料APIは非商用利用条件に基づいて使用
