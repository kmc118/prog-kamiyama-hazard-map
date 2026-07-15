# 神山町 通学路危険マップ

徳島県神山町の通学路にある危険箇所、自動販売機、通学ルートを地図上で確認・登録するWebアプリです。

## GitHub Pagesで公開する

### 1. GitHubにリポジトリを作る

1. GitHubにログインし、右上の `+` から `New repository` を選びます。
2. Repository nameに任意の名前（例: `kamiyama-hazard-map`）を入力します。
3. `Public` を選び、`Create repository` を押します。

### 2. ファイルをアップロードする

1. 作成したリポジトリで `uploading an existing file` を選びます。
2. このフォルダ内のファイルとフォルダを、構造を保ったままアップロードします。
3. 画面下部の `Commit changes` を押します。

`.github/workflows/deploy-pages.yml` も必ずアップロードしてください。このファイルが公開用アプリを自動生成します。

### 3. GitHub Pagesを有効にする

1. リポジトリの `Settings` を開きます。
2. 左側の `Pages` を開きます。
3. `Build and deployment` の `Source` で `GitHub Actions` を選びます。
4. リポジトリの `Actions` で `Deploy to GitHub Pages` が完了するまで待ちます。

公開URLは通常、次の形式です。

```text
https://GitHubのユーザー名.github.io/リポジトリ名/
```

## ローカルで動かす

Node.js 22以降をインストールし、次を実行します。

```bash
npm install
npm run dev
```

本番用ファイルの確認:

```bash
npm run build
npm run preview
```

## データと保存について

- 初期データは `public/data/progq205-3.geojson` から読み込みます。
- 利用者が追加したピンやルートは、その利用者のブラウザ内（localStorage）に保存されます。他の利用者には自動共有されません。
- 地図タイルにはOpenStreetMap、ルート候補にはOSRM、天気情報にはOpen-Meteoを利用しています。各サービスの利用条件に従ってください。
- 写真に個人情報や児童の顔、自宅を特定できる情報を含めないよう注意してください。
