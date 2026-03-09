import streamlit as st
import pandas as pd
import plotly.express as px
import io
import base64
import requests

# ─────────────────────────────────────────
# 定数
# ─────────────────────────────────────────
CSV_COLUMNS = ["枠名", "楽曲名", "歌唱順", "配信日", "枠URL", "コラボ相手様", "原曲Artist", "作詞", "作曲", "リリース日"]

# ─────────────────────────────────────────
# GitHub ヘルパー
# ─────────────────────────────────────────
def _gh_secrets_ok() -> bool:
    required = ["github_token", "github_repo", "github_csv_path"]
    return all(k in st.secrets for k in required)

def _gh_headers() -> dict:
    return {
        "Authorization": f"Bearer {st.secrets['github_token']}",
        "Accept": "application/vnd.github+json",
    }

def _gh_branch() -> str:
    return st.secrets.get("github_branch", "main")

def load_df() -> pd.DataFrame:
    """GitHubからCSVを読み込んでDataFrameを返す。secrets未設定時はローカルフォールバック。"""
    empty = pd.DataFrame(columns=CSV_COLUMNS)

    if not _gh_secrets_ok():
        # ローカル開発用：カレントディレクトリの streaming_info.csv を読む
        try:
            df = pd.read_csv("streaming_info.csv", encoding="utf-8-sig")
            return _normalize_df(df)
        except FileNotFoundError:
            return empty

    repo  = st.secrets["github_repo"]
    path  = st.secrets["github_csv_path"]
    branch = _gh_branch()
    url   = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"

    try:
        res = requests.get(url, headers=_gh_headers(), timeout=10)
        if res.status_code == 404:
            return empty
        res.raise_for_status()
        content = base64.b64decode(res.json()["content"])
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        return _normalize_df(df)
    except Exception as e:
        st.warning(f"GitHubからのデータ読み込みに失敗しました: {e}")
        return empty

def push_df(df: pd.DataFrame, commit_msg: str = "Update streaming data") -> tuple[bool, str]:
    """DataFrameをCSVとしてGitHubにコミットする。"""
    if not _gh_secrets_ok():
        # ローカル：ファイルに保存するだけ
        df.to_csv("streaming_info.csv", index=False, encoding="utf-8-sig")
        return True, "ローカルファイルに保存しました。"

    repo   = st.secrets["github_repo"]
    path   = st.secrets["github_csv_path"]
    branch = _gh_branch()
    url    = f"https://api.github.com/repos/{repo}/contents/{path}"

    try:
        # 既存ファイルのSHAを取得（更新に必要）
        res = requests.get(f"{url}?ref={branch}", headers=_gh_headers(), timeout=10)
        sha = res.json().get("sha") if res.status_code == 200 else None

        csv_bytes = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
        payload = {
            "message": commit_msg,
            "content": base64.b64encode(csv_bytes).decode(),
            "branch":  branch,
        }
        if sha:
            payload["sha"] = sha

        res = requests.put(url, headers=_gh_headers(), json=payload, timeout=15)
        res.raise_for_status()
        return True, "GitHubにコミットしました。"
    except Exception as e:
        return False, f"GitHubへのコミットに失敗しました: {e}"

def _normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    """型の正規化・欠損補完。"""
    for col in CSV_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[CSV_COLUMNS].copy()
    df["歌唱順"] = pd.to_numeric(df["歌唱順"], errors="coerce").fillna(0).astype(int)
    df["配信日"] = df["配信日"].apply(_parse_date)
    df["コラボ相手様"] = df["コラボ相手様"].fillna("なし").astype(str)
    for col in ["枠URL", "原曲Artist", "作詞", "作曲"]:
        df[col] = df[col].fillna("").astype(str)
    df["リリース日"] = df["リリース日"].apply(lambda v: "" if pd.isna(v) or str(v).strip() in ("", "nan", "NaN") else str(v).strip())
    return df

def _parse_date(val) -> str:
    import re
    s = str(val).strip()
    m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", s)
    if m:
        s = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return s

# ─────────────────────────────────────────
# 認証ヘルパー
# ─────────────────────────────────────────
def check_password() -> bool:
    if "admin_password" not in st.secrets:
        return True
    if st.session_state.get("authenticated"):
        return True

    st.sidebar.divider()
    st.sidebar.markdown("#### 🔒 管理者ログイン")
    pw = st.sidebar.text_input("パスワード", type="password", key="pw_input")
    if st.sidebar.button("ログイン", use_container_width=True):
        if pw == st.secrets["admin_password"]:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.sidebar.error("パスワードが違います")
    return False

def logout_button():
    st.sidebar.divider()
    if st.sidebar.button("🔓 ログアウト", use_container_width=True):
        st.session_state["authenticated"] = False
        st.rerun()

# ─────────────────────────────────────────
# ページ：配信枠
# ─────────────────────────────────────────
def page_streams(df: pd.DataFrame):
    st.header("📋 配信枠一覧")

    if df.empty:
        st.info("配信枠がまだ登録されていません。")
        return

    streams = (
        df[["枠名", "配信日", "枠URL"]]
        .drop_duplicates(subset=["枠名", "配信日"])
        .sort_values("配信日", ascending=False)
        .reset_index(drop=True)
    )

    for _, row in streams.iterrows():
        label = f"**{row['配信日']}**　{row['枠名']}"
        with st.expander(label, expanded=False):
            setlist = (
                df[df["枠名"] == row["枠名"]]
                [["歌唱順", "楽曲名", "コラボ相手様", "枠URL"]]
                .sort_values("歌唱順")
                .rename(columns={"枠URL": "楽曲URL"})
                .reset_index(drop=True)
            )
            if setlist.empty:
                st.info("この枠にはまだ曲が登録されていません。")
            else:
                st.dataframe(
                    setlist,
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        "楽曲URL": st.column_config.LinkColumn(
                            "楽曲URL",
                            display_text="▶ 開く",
                        )
                    }
                )

# ─────────────────────────────────────────
# ページ：曲一覧 & 統計
# ─────────────────────────────────────────
def page_songs(df: pd.DataFrame):
    st.header("🎵 曲一覧 & 統計")

    if df.empty:
        st.info("曲がまだ登録されていません。")
        return

    # 曲ごとに集計（作詞・作曲・アーティストは最初の非空値を使う）
    count_df = (
        df.groupby("楽曲名", as_index=False)
        .agg(
            原曲アーティスト=("原曲Artist", lambda x: next((v for v in x if v), "")),
            作詞=("作詞", lambda x: next((v for v in x if v), "")),
            作曲=("作曲", lambda x: next((v for v in x if v), "")),
            リリース日=("リリース日", lambda x: next((v for v in x if v), "")),
            歌唱回数=("楽曲名", "count"),
        )
        .sort_values("歌唱回数", ascending=False)
        .reset_index(drop=True)
    )

    # リリース日からリリース年を導出（yyyy年形式）
    def to_release_year(val):
        v = str(val).strip()
        if not v or v in ("nan", "NaN", ""):
            return ""
        # 「yyyy年m月d日」形式を変換してからパース
        import re
        m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", v)
        if m:
            v = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        try:
            return f"{pd.to_datetime(v).year}年"
        except Exception:
            return ""
    count_df["リリース年"] = count_df["リリース日"].apply(to_release_year)
    # 列順を整える：リリース日の直後にリリース年を配置
    cols = list(count_df.columns)
    if "リリース年" in cols and "リリース日" in cols:
        cols.remove("リリース年")
        idx = cols.index("リリース日") + 1
        cols.insert(idx, "リリース年")
        count_df = count_df[cols]

    st.dataframe(count_df, use_container_width=True, hide_index=True)

    st.subheader("歌唱回数ランキング（上位20曲）")
    top20 = count_df[count_df["歌唱回数"] > 0].head(20)
    if top20.empty:
        st.info("まだデータがありません。")
    else:
        fig = px.bar(
            top20,
            x="歌唱回数",
            y="楽曲名",
            orientation="h",
            color="歌唱回数",
            color_continuous_scale="Blues",
            hover_data=["原曲アーティスト", "作詞", "作曲"],
        )
        fig.update_layout(
            yaxis=dict(autorange="reversed"),
            coloraxis_showscale=False,
            height=max(400, len(top20) * 28),
        )
        st.plotly_chart(fig, use_container_width=True)

# ─────────────────────────────────────────
# ページ：データ管理（認証必須）
# ─────────────────────────────────────────
def page_data_management(df: pd.DataFrame):
    st.header("🔄 データ管理")

    if not check_password():
        st.info("👈 サイドバーからパスワードを入力してください。")
        return

    logout_button()

    col_ex, col_im = st.columns(2)

    # ── エクスポート ──
    with col_ex:
        st.subheader("📤 エクスポート")
        st.markdown("現在のデータをCSV形式でダウンロードします。")
        csv_bytes = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
        st.download_button(
            label="⬇️ CSVダウンロード",
            data=csv_bytes,
            file_name="streaming_info.csv",
            mime="text/csv",
            use_container_width=True,
        )

    # ── インポート ──
    with col_im:
        st.subheader("📥 インポート（完全上書き）")
        st.warning(
            "⚠️ インポートすると既存データはすべて削除され、CSVの内容に置き換えられます。",
            icon="⚠️",
        )
        uploaded = st.file_uploader(
            "CSVファイルを選択（UTF-8 / Shift-JIS）",
            type=["csv"],
            key="import_csv",
        )
        if uploaded:
            if st.button("🔁 インポート実行", use_container_width=True, type="primary"):
                raw = uploaded.read()
                new_df = None
                for enc in ("utf-8-sig", "cp932", "utf-8"):
                    try:
                        new_df = pd.read_csv(io.BytesIO(raw), encoding=enc)
                        break
                    except Exception:
                        continue

                if new_df is None:
                    st.error("文字コードを判別できませんでした。")
                else:
                    missing = [c for c in ["枠名", "楽曲名", "歌唱順", "配信日"] if c not in new_df.columns]
                    if missing:
                        st.error(f"必要な列が不足しています: {missing}")
                    else:
                        new_df = _normalize_df(new_df)
                        ok, msg = push_df(new_df, commit_msg="Update: CSV import via app")
                        if ok:
                            st.success(f"{len(new_df)} 件をインポートし、GitHubにコミットしました。")
                            st.cache_data.clear()
                            st.rerun()
                        else:
                            st.error(msg)

    st.divider()
    st.subheader("📋 CSVフォーマット")
    st.dataframe(
        pd.DataFrame({
            "列名": CSV_COLUMNS,
            "例": [
                "【初配信】初めまして、妃玖です。",
                "メビウス",
                "1",
                "2026-01-01",
                "https://www.youtube.com/live/xxxxx",
                "なし",
                "柊キライ",
                "柊キライ",
                "柊キライ",
                "2021-03-15",
            ],
        }),
        use_container_width=True,
        hide_index=True,
    )

# ─────────────────────────────────────────
# データ読み込み（キャッシュ付き）
# ─────────────────────────────────────────
@st.cache_data(ttl=60)
def get_data() -> pd.DataFrame:
    return load_df()

def debug_github():
    """GitHub接続の診断情報を表示する（一時的なデバッグ用）。"""
    st.subheader("🔍 GitHub接続診断")
    if not _gh_secrets_ok():
        st.error("secrets に github_token / github_repo / github_csv_path が設定されていません。")
        return

    repo   = st.secrets["github_repo"]
    path   = st.secrets["github_csv_path"]
    branch = _gh_branch()

    st.code(f"repo:   {repo}\npath:   {path}\nbranch: {branch}")

    url = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"
    try:
        res = requests.get(url, headers=_gh_headers(), timeout=10)
        st.write(f"HTTPステータス: **{res.status_code}**")
        if res.status_code == 200:
            info = res.json()
            st.success(f"✅ ファイル発見！サイズ: {info.get('size')} bytes")
        elif res.status_code == 404:
            st.error("❌ ファイルが見つかりません。パスまたはブランチ名を確認してください。")
            # リポジトリのルート一覧を表示
            root_url = f"https://api.github.com/repos/{repo}/contents/?ref={branch}"
            root_res = requests.get(root_url, headers=_gh_headers(), timeout=10)
            if root_res.status_code == 200:
                files = [f["name"] for f in root_res.json() if isinstance(root_res.json(), list)]
                st.write("リポジトリのルートにあるファイル一覧:")
                st.write(files)
        elif res.status_code == 401:
            st.error("❌ 認証エラー。github_token が無効または期限切れです。")
        else:
            st.error(f"❌ 予期しないエラー: {res.text[:300]}")
    except Exception as e:
        st.error(f"接続エラー: {e}")

# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="🐍妃玖 歌ってみたDB",
        page_icon="🐍",
        layout="wide"
    )

    # ─── グローバルCSS：コンパクト化 ───
    st.markdown("""
    <style>
    html, body, [class*="css"] { font-size: 14px !important; }
    h1 { font-size: 1.5rem !important; }
    h2 { font-size: 1.2rem !important; }
    h3 { font-size: 1.05rem !important; }
    .stDataFrame, .stDataFrame td, .stDataFrame th { font-size: 13px !important; }
    .streamlit-expanderHeader { font-size: 13px !important; }
    details summary p { font-size: 13px !important; }
    [data-testid="stSidebar"] * { font-size: 13px !important; }
    .stButton button, .stDownloadButton button { font-size: 13px !important; padding: 4px 12px !important; }
    .stAlert p { font-size: 13px !important; }
    p { line-height: 1.5 !important; }
    /* サイドバー：ラジオボタンを中央寄せ */
    [data-testid="stSidebar"] [data-testid="stRadio"] { text-align: center; }
    [data-testid="stSidebar"] [data-testid="stRadio"] > div { display: inline-block; text-align: left; }
    </style>
    """, unsafe_allow_html=True)

    BANNER_URL = (
        "https://yt3.googleusercontent.com/u3MLvApeviPLt_-RPfqiPB1ZPeEtaBknWDv-jKyzMGEijRaireQ2zfxK1HmkuDtJpUIW_uVXxEY"
        "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
    )

    # ─── メイン：タイトルのみ ───
    st.title("🐍妃玖 歌ってみたDB")

    # ─── サイドバー：バナー → タイトル → menu → ラジオ ───
    st.sidebar.image(BANNER_URL, use_container_width=True)
    st.sidebar.markdown(
        """
        <div style="text-align:center; line-height:1.8; padding: 6px 0 2px 0;">
            <div style="font-size:1.0rem; font-weight:bold;">
                🐍⚜🎶芋虫羽虫㌠の部屋🎶⚜🐍
            </div>
            <div style="font-size:0.8rem; color:#aaa; margin-top:4px;">menu</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    page = st.sidebar.radio(
        label="",
        options=["配信枠", "曲一覧 & 統計", "データ管理"],
        format_func=lambda x: {
            "配信枠":        "📺 LiveStreaming Info",
            "曲一覧 & 統計": "🎵 Uta-Mita DB",
            "データ管理":    "🔄 Data Management",
        }[x],
    )

    df = get_data()

    if page == "配信枠":
        page_streams(df)
    elif page == "曲一覧 & 統計":
        page_songs(df)
    else:
        page_data_management(df)

    # ─── 一時デバッグ：管理者のみ表示 ───
    if st.session_state.get("authenticated") or "admin_password" not in st.secrets:
        with st.sidebar.expander("🔍 接続診断", expanded=False):
            if st.button("診断実行", key="debug_btn"):
                debug_github()

if __name__ == "__main__":
    main()
