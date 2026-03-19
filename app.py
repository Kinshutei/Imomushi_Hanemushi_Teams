import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import io
import base64
import requests
import re

# ─────────────────────────────────────────
# 定数
# ─────────────────────────────────────────
STREAMING_COLUMNS = ["枠名", "song_id", "歌唱順", "配信日", "枠URL", "コラボ相手様"]
MASTER_COLUMNS    = ["song_id", "楽曲名", "原曲アーティスト", "作詞", "作曲", "リリース日"]

# ─────────────────────────────────────────
# GitHub ヘルパー
# ─────────────────────────────────────────
def _gh_secrets_ok() -> bool:
    return all(k in st.secrets for k in ["github_token", "github_repo", "github_csv_path"])

def _gh_master_secrets_ok() -> bool:
    return _gh_secrets_ok() and "github_master_path" in st.secrets

def _gh_headers() -> dict:
    return {
        "Authorization": f"Bearer {st.secrets['github_token']}",
        "Accept": "application/vnd.github+json",
    }

def _gh_branch() -> str:
    return st.secrets.get("github_branch", "main")

def _gh_load(path: str) -> bytes | None:
    """GitHubから指定パスのファイルをbytesで取得。"""
    repo   = st.secrets["github_repo"]
    branch = _gh_branch()
    url    = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"
    try:
        res = requests.get(url, headers=_gh_headers(), timeout=10)
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return base64.b64decode(res.json()["content"])
    except Exception as e:
        st.warning(f"GitHubからの読み込みに失敗 ({path}): {e}")
        return None

def _gh_push(path: str, df: pd.DataFrame, commit_msg: str) -> tuple[bool, str]:
    """DataFrameをCSVとしてGitHubにコミット。"""
    if not _gh_secrets_ok():
        df.to_csv(path, index=False, encoding="utf-8-sig")
        return True, f"ローカルに保存しました: {path}"

    repo   = st.secrets["github_repo"]
    branch = _gh_branch()
    url    = f"https://api.github.com/repos/{repo}/contents/{path}"

    try:
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
        return False, f"GitHubへのコミットに失敗: {e}"

# ─────────────────────────────────────────
# データ読み込み
# ─────────────────────────────────────────
def _parse_date(val) -> str:
    s = str(val).strip()
    m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", s)
    if m:
        s = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return s

def _normalize_streaming(df: pd.DataFrame) -> pd.DataFrame:
    for col in STREAMING_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[STREAMING_COLUMNS].copy()
    df["歌唱順"]      = pd.to_numeric(df["歌唱順"], errors="coerce").fillna(0).astype(int)
    df["配信日"]      = df["配信日"].apply(_parse_date)
    df["コラボ相手様"] = df["コラボ相手様"].fillna("なし").astype(str)
    df["song_id"]     = df["song_id"].fillna("").astype(str)
    df["枠URL"]       = df["枠URL"].fillna("").astype(str)
    return df

def _normalize_master(df: pd.DataFrame) -> pd.DataFrame:
    for col in MASTER_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[MASTER_COLUMNS].copy()
    for col in MASTER_COLUMNS:
        df[col] = df[col].fillna("").astype(str).str.strip()
    return df

def load_streaming_df() -> pd.DataFrame:
    empty = pd.DataFrame(columns=STREAMING_COLUMNS)
    if not _gh_secrets_ok():
        try:
            df = pd.read_csv("streaming_info.csv", encoding="utf-8-sig")
            return _normalize_streaming(df)
        except FileNotFoundError:
            return empty

    content = _gh_load(st.secrets["github_csv_path"])
    if content is None:
        return empty
    try:
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        return _normalize_streaming(df)
    except Exception as e:
        st.warning(f"streaming_info.csv のパースに失敗: {e}")
        return empty

def load_master_df() -> pd.DataFrame:
    empty = pd.DataFrame(columns=MASTER_COLUMNS)
    if not _gh_master_secrets_ok():
        try:
            df = pd.read_csv("rkmusic_song_master.csv", encoding="utf-8-sig")
            return _normalize_master(df)
        except FileNotFoundError:
            return empty

    content = _gh_load(st.secrets["github_master_path"])
    if content is None:
        return empty
    try:
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        return _normalize_master(df)
    except Exception as e:
        st.warning(f"rkmusic_song_master.csv のパースに失敗: {e}")
        return empty

def get_joined_df(streaming: pd.DataFrame, master: pd.DataFrame) -> pd.DataFrame:
    """streaming_info と song_master を song_id でマージして表示用DFを返す。"""
    if streaming.empty:
        return pd.DataFrame(columns=STREAMING_COLUMNS + ["楽曲名", "原曲アーティスト", "作詞", "作曲", "リリース日"])
    joined = streaming.merge(master, on="song_id", how="left")
    for col in ["楽曲名", "原曲アーティスト", "作詞", "作曲", "リリース日"]:
        if col not in joined.columns:
            joined[col] = ""
        joined[col] = joined[col].fillna("").astype(str)
    return joined

@st.cache_data(ttl=60)
def get_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    streaming = load_streaming_df()
    master    = load_master_df()
    joined    = get_joined_df(streaming, master)
    return streaming, master, joined

# ─────────────────────────────────────────
# 認証
# ─────────────────────────────────────────
def check_password() -> bool:
    if "admin_password" not in st.secrets:
        return True
    if st.session_state.get("authenticated"):
        return True
    st.divider()
    st.markdown("#### 🔒 管理者ログイン")
    pw = st.text_input("パスワード", type="password", key="pw_input")
    if st.button("ログイン"):
        if pw == st.secrets["admin_password"]:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("パスワードが違います")
    return False

def logout_button():
    if st.button("🔓 ログアウト"):
        st.session_state["authenticated"] = False
        st.rerun()

# ─────────────────────────────────────────
# ページ：LiveStreaming Info
# ─────────────────────────────────────────
def page_streams(joined: pd.DataFrame):
    if joined.empty:
        st.info("配信枠がまだ登録されていません。")
        return

    if "streams_expanded" not in st.session_state:
        st.session_state.streams_expanded = False

    _fc1, _fc2, _fc3 = st.columns([1, 1, 8])
    with _fc1:
        if st.button("▼ 全て開く", key="btn_expand_all", use_container_width=True):
            st.session_state.streams_expanded = True
            st.rerun()
    with _fc2:
        if st.button("▲ 全て閉じる", key="btn_collapse_all", use_container_width=True):
            st.session_state.streams_expanded = False
            st.rerun()

    streams = (
        joined[["枠名", "配信日", "枠URL"]]
        .drop_duplicates(subset=["枠名", "配信日"])
        .sort_values("配信日", ascending=False)
        .reset_index(drop=True)
    )

    # 初披露判定用マップ（楽曲名 → (配信日, 歌唱順) の最小）
    first_map = {}
    for _, r in joined.iterrows():
        name = r["楽曲名"]
        if not name:
            continue
        key = (r["配信日"], int(r["歌唱順"]))
        if name not in first_map or key < first_map[name]:
            first_map[name] = key

    for _, row in streams.iterrows():
        label = f"**{row['配信日']}**　{row['枠名']}"
        with st.expander(label, expanded=st.session_state.streams_expanded):
            setlist = (
                joined[joined["枠名"] == row["枠名"]]
                [["歌唱順", "楽曲名", "原曲アーティスト", "コラボ相手様", "枠URL"]]
                .sort_values("歌唱順")
                .reset_index(drop=True)
            )

            thumb_url = None
            yt_match = re.search(r"(?:v=|live/)([A-Za-z0-9_-]{11})", str(row.get("枠URL", "")))
            if yt_match:
                vid = yt_match.group(1)
                thumb_url = f"https://img.youtube.com/vi/{vid}/mqdefault.jpg"
                clean_url = f"https://www.youtube.com/live/{vid}"

            col_thumb, col_table = st.columns([1, 2])
            with col_thumb:
                if thumb_url:
                    st.image(thumb_url, use_container_width=True)
                    st.markdown(f"[▶ YouTubeで開く]({clean_url})")
                else:
                    st.caption("サムネイルなし")

            with col_table:
                if setlist.empty:
                    st.info("この枠にはまだ曲が登録されていません。")
                else:
                    # 初マーク付与
                    def mark_first(r2):
                        name = r2["楽曲名"]
                        if name and first_map.get(name) == (r2["配信日"] if "配信日" in r2 else None, int(r2["歌唱順"])):
                            return f"🆕 {name}"
                        return name
                    # 配信日を付加してから判定
                    setlist_marked = setlist.copy()
                    setlist_marked["_date"] = row["配信日"]
                    setlist_marked["楽曲名"] = setlist_marked.apply(
                        lambda r2: f"🆕 {r2['楽曲名']}"
                        if r2["楽曲名"] and first_map.get(r2["楽曲名"]) == (row["配信日"], int(r2["歌唱順"]))
                        else r2["楽曲名"],
                        axis=1
                    )
                    display_cols = setlist_marked[["歌唱順", "楽曲名", "原曲アーティスト", "コラボ相手様", "枠URL"]]
                    st.dataframe(
                        display_cols.rename(columns={"枠URL": "楽曲URL"}),
                        use_container_width=True,
                        hide_index=True,
                        column_config={
                            "楽曲URL": st.column_config.LinkColumn("楽曲URL", display_text="▶ 開く"),
                        }
                    )

# ─────────────────────────────────────────
# ページ：Uta-Mita DB
# ─────────────────────────────────────────
def _to_release_year(val) -> str:
    v = str(val).strip()
    if not v or v in ("nan", "NaN", ""):
        return ""
    m = re.match(r"(\d{4})年(\d{1,2})月(\d{1,2})日", v)
    if m:
        v = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    try:
        return f"{pd.to_datetime(v).year}年"
    except Exception:
        return ""

def page_songs(joined: pd.DataFrame):
    if joined.empty:
        st.info("曲がまだ登録されていません。")
        return

    count_df = (
        joined.groupby("楽曲名", as_index=False)
        .agg(
            原曲アーティスト=("原曲アーティスト", lambda x: next((v for v in x if v), "")),
            作詞=("作詞", lambda x: next((v for v in x if v), "")),
            作曲=("作曲", lambda x: next((v for v in x if v), "")),
            リリース日=("リリース日", lambda x: next((v for v in x if v), "")),
            歌唱回数=("楽曲名", "count"),
        )
        .sort_values("歌唱回数", ascending=False)
        .reset_index(drop=True)
    )

    st.dataframe(count_df, use_container_width=True, hide_index=True)

    # 歌唱回数ランキング
    st.subheader("歌唱回数ランキング（上位20曲）")
    top20 = count_df.head(20).copy()
    if top20.empty:
        st.info("まだデータがありません。")
    else:
        max_count = top20["歌唱回数"].max()
        top20["_c"] = top20["歌唱回数"].apply(
            lambda v: f"rgba(100,158,100,{0.25 + 0.55 * v / max_count})"
        )
        fig = px.bar(
            top20, x="歌唱回数", y="楽曲名", orientation="h", text="歌唱回数",
            hover_data=["原曲アーティスト", "作詞", "作曲"],
        )
        fig.update_traces(
            marker_color=top20["_c"].tolist(),
            marker_line_width=0,
            textposition="outside",
            textfont=dict(size=11, color="#888888"),
        )
        fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#555555", size=12),
            yaxis=dict(autorange="reversed", showgrid=False, tickfont=dict(size=11, color="#666666"), automargin=True),
            xaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.06)", zeroline=False, tickfont=dict(size=10, color="#888888")),
            coloraxis_showscale=False,
            height=max(380, len(top20) * 26),
            margin=dict(l=16, r=55, t=16, b=10),
        )
        st.plotly_chart(fig, use_container_width=True)

    # リリース年度分布（棒グラフ）
    st.subheader("リリース年度分布")
    count_df["リリース年"] = count_df["リリース日"].apply(_to_release_year)
    year_df = (
        count_df[count_df["リリース年"].str.len() > 0]
        .groupby("リリース年", as_index=False)
        .agg(曲数=("楽曲名", "count"))
        .sort_values("リリース年")
    )
    if year_df.empty:
        st.info("リリース年データがまだありません。")
    else:
        max_y = year_df["曲数"].max()
        year_df["_c"] = year_df["曲数"].apply(
            lambda v: f"rgba(95,207,128,{0.25 + 0.65 * v / max_y})"
        )
        fig_year = go.Figure(go.Bar(
            x=year_df["リリース年"],
            y=year_df["曲数"],
            text=year_df["曲数"],
            textposition="outside",
            marker_color=year_df["_c"].tolist(),
            marker_line_width=0,
            hovertemplate="<b>%{x}</b><br>%{y}曲<extra></extra>",
        ))
        fig_year.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="#a0a0a0", size=11),
            xaxis=dict(tickangle=-45, showgrid=False, color="#606060"),
            yaxis=dict(showgrid=True, gridcolor="rgba(255,255,255,0.05)", zeroline=False, color="#606060"),
            margin=dict(l=40, r=20, t=24, b=70),
            height=320,
        )
        st.plotly_chart(fig_year, use_container_width=True)

    # 原曲アーティスト分布
    st.subheader("原曲アーティスト分布")
    artist_df = (
        count_df.groupby("原曲アーティスト", as_index=False)
        .agg(歌唱回数=("歌唱回数", "sum"))
        .sort_values("歌唱回数", ascending=False)
    )
    artist_df = artist_df[artist_df["原曲アーティスト"].str.len() > 0]
    if artist_df.empty:
        st.info("アーティストデータがまだありません。")
    else:
        total = artist_df["歌唱回数"].sum()
        fig_tree = px.treemap(
            artist_df, path=["原曲アーティスト"], values="歌唱回数",
            color="歌唱回数",
            color_continuous_scale=[[0.0,"#1a2e1a"],[0.4,"#2a4a2a"],[0.7,"#3a7a4a"],[1.0,"#5fcf80"]],
        )
        fig_tree.update_traces(
            texttemplate="<b>%{label}</b><br>%{value}曲",
            textfont=dict(size=13, color="#3a3a3a"),
            marker=dict(line=dict(width=2, color="#ffffff"), pad=dict(t=22, l=4, r=4, b=4)),
            hovertemplate="<b>%{label}</b><br>%{value}曲 (" + f"{1/total*100:.1f}" + "% avg)<extra></extra>",
        )
        fig_tree.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", font=dict(color="#555555"),
            coloraxis_showscale=False,
            margin=dict(t=4, l=0, r=0, b=0), height=420,
        )
        st.plotly_chart(fig_tree, use_container_width=True)

# ─────────────────────────────────────────
# ページ：データ管理
# ─────────────────────────────────────────
def page_data_management(streaming: pd.DataFrame, master: pd.DataFrame):
    if not check_password():
        return

    logout_button()

    tab_stream, tab_master = st.tabs(["配信情報管理", "楽曲マスター管理"])

    # ── 配信情報タブ ──
    with tab_stream:
        col_ex, col_im = st.columns(2)
        with col_ex:
            st.subheader("📤 エクスポート")
            csv_bytes = streaming.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
            st.download_button(
                label="⬇️ streaming_info.csv ダウンロード",
                data=csv_bytes,
                file_name="streaming_info.csv",
                mime="text/csv",
                use_container_width=True,
            )

        with col_im:
            st.subheader("📥 インポート（完全上書き）")
            st.warning("⚠️ インポートすると既存データはすべて上書きされます。", icon="⚠️")
            uploaded = st.file_uploader("CSVファイル（UTF-8 / Shift-JIS）", type=["csv"], key="import_streaming")
            if uploaded:
                if st.button("インポート実行", use_container_width=True, type="primary", key="btn_import_streaming"):
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
                        missing = [c for c in ["枠名", "song_id", "歌唱順", "配信日"] if c not in new_df.columns]
                        if missing:
                            st.error(f"必要な列が不足: {missing}")
                        else:
                            new_df = _normalize_streaming(new_df)
                            ok, msg = _gh_push(st.secrets.get("github_csv_path", "streaming_info.csv"), new_df, "Update: streaming_info import via app")
                            if ok:
                                st.success(f"{len(new_df)} 件をインポートしました。")
                                st.cache_data.clear()
                                st.rerun()
                            else:
                                st.error(msg)

        st.divider()
        st.subheader("📋 CSVフォーマット")
        st.dataframe(
            pd.DataFrame({
                "列名": STREAMING_COLUMNS,
                "例": ["【初配信】初めまして、妃玖です。", "S0456", "1", "2026-01-01",
                       "https://www.youtube.com/live/xxxxx", "なし"],
            }),
            use_container_width=True, hide_index=True,
        )

    # ── 楽曲マスタータブ ──
    with tab_master:
        st.subheader(f"楽曲マスター（現在 {len(master)} 曲）")

        col_ex2, col_im2 = st.columns(2)
        with col_ex2:
            master_bytes = master.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
            st.download_button(
                label="⬇️ rkmusic_song_master.csv ダウンロード",
                data=master_bytes,
                file_name="rkmusic_song_master.csv",
                mime="text/csv",
                use_container_width=True,
            )

        with col_im2:
            st.warning("⚠️ マスターインポートは既存データを完全上書きします。", icon="⚠️")
            uploaded_m = st.file_uploader("CSVファイル", type=["csv"], key="import_master")
            if uploaded_m:
                if st.button("マスターインポート実行", use_container_width=True, type="primary", key="btn_import_master"):
                    raw = uploaded_m.read()
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
                        missing = [c for c in ["song_id", "楽曲名"] if c not in new_df.columns]
                        if missing:
                            st.error(f"必要な列が不足: {missing}")
                        else:
                            new_df = _normalize_master(new_df)
                            master_path = st.secrets.get("github_master_path", "rkmusic_song_master.csv")
                            ok, msg = _gh_push(master_path, new_df, "Update: rkmusic_song_master import via app")
                            if ok:
                                st.success(f"{len(new_df)} 曲のマスターをコミットしました。")
                                st.cache_data.clear()
                                st.rerun()
                            else:
                                st.error(msg)

        st.divider()
        st.dataframe(master, use_container_width=True, hide_index=True)
        st.subheader("📋 マスターCSVフォーマット")
        st.dataframe(
            pd.DataFrame({
                "列名": MASTER_COLUMNS,
                "例": ["S0001", "ラプンツェル", "n-buna", "n-buna", "n-buna", "2016/7/6"],
            }),
            use_container_width=True, hide_index=True,
        )

# ─────────────────────────────────────────
# デバッグ診断
# ─────────────────────────────────────────
def debug_github():
    st.subheader("🔍 GitHub接続診断")
    if not _gh_secrets_ok():
        st.error("secrets に github_token / github_repo / github_csv_path が未設定です。")
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
            st.success(f"✅ streaming_info.csv 発見 ({res.json().get('size')} bytes)")
        elif res.status_code == 404:
            st.error("❌ ファイルが見つかりません。")
        elif res.status_code == 401:
            st.error("❌ 認証エラー。github_token を確認してください。")
        else:
            st.error(f"❌ エラー: {res.text[:300]}")
    except Exception as e:
        st.error(f"接続エラー: {e}")

    # マスターファイル確認
    if _gh_master_secrets_ok():
        master_path = st.secrets["github_master_path"]
        master_url = f"https://api.github.com/repos/{repo}/contents/{master_path}?ref={branch}"
        try:
            res2 = requests.get(master_url, headers=_gh_headers(), timeout=10)
            if res2.status_code == 200:
                st.success(f"✅ rkmusic_song_master.csv 発見 ({res2.json().get('size')} bytes)")
            else:
                st.warning(f"⚠️ rkmusic_song_master.csv: HTTP {res2.status_code}")
        except Exception as e:
            st.error(f"マスター確認エラー: {e}")

# ─────────────────────────────────────────
# メイン
# ─────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="妃玖 歌ってみたDB",
        page_icon="🐍",
        layout="wide"
    )

    BANNER_URL = (
        "https://yt3.googleusercontent.com/u3MLvApeviPLt_-RPfqiPB1ZPeEtaBknWDv-jKyzMGEijRaireQ2zfxK1HmkuDtJpUIW_uVXxEY"
        "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
    )

    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap');
    html, body, [class*="css"] { font-family: 'Noto Sans JP', sans-serif !important; font-size: 14px !important; }
    h1 { font-size: 1.5rem !important; }
    h2 { font-size: 1.2rem !important; }
    h3 { font-size: 1.05rem !important; }
    .stDataFrame, .stDataFrame td, .stDataFrame th { font-size: 13px !important; }
    .streamlit-expanderHeader { font-size: 13px !important; }
    details summary p { font-size: 13px !important; }
    .stButton button, .stDownloadButton button { font-size: 13px !important; padding: 4px 12px !important; }
    .stAlert p { font-size: 13px !important; }
    p { line-height: 1.5 !important; }
    .banner-wrap { margin: -4rem -4rem 0 -4rem; line-height: 0; }
    .banner-wrap img { width: 100%; display: block; max-height: 220px; object-fit: cover; }
    [data-testid="stTabs"] button p { font-size: 1.1rem !important; font-weight: bold !important; }
    details summary:hover { background-color: rgba(0,0,0,0.04) !important; }
    details summary svg { display: none !important; }
    details:not([open]) summary::before {
        content: "";
        display: inline-block;
        width: 18px; height: 18px;
        margin-right: 8px;
        vertical-align: middle;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        opacity: 0.75;
    }
    details[open] summary::before {
        content: "⚜";
        margin-right: 8px;
        font-size: 0.95rem;
        vertical-align: middle;
    }
    </style>
    """, unsafe_allow_html=True)

    st.markdown(
        f'<div class="banner-wrap"><img src="{BANNER_URL}" /></div>',
        unsafe_allow_html=True,
    )

    streaming, master, joined = get_data()

    page_data_management(streaming, master)

    if st.session_state.get("authenticated") or "admin_password" not in st.secrets:
        with st.expander("🔍 接続診断", expanded=False):
            if st.button("診断実行", key="debug_btn"):
                debug_github()

if __name__ == "__main__":
    main()
