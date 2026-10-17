/* FoodWalk Notebook - app logic */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DEFAULT_REVIEW = `{店名}へ🍽️

{料理}をいただきました。
{味}
{ボリューム}
{雰囲気}

{地域}
{価格}

#食べ歩き #グルメ #{店名}`;
  const DEFAULT_SHORT = `{店名}で{料理}🍴
{味}
{価格}
#食べ歩き #グルメ`;
  const STATUS = {
    pending: ["未投稿", "pending"],
    draft: ["投稿準備中", "draft"],
    posted: ["投稿済み", "posted"]
  };
  let selectedPhotoBlob = null;
  let selectedPhotoUrl = null;
  let activeRecordId = null;
  let postRecordId = null;
  let toastTimer = null;

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  function statusBadge(status) {
    const s = STATUS[status] || STATUS.pending;
    return `<span class="badge ${s[1]}">${s[0]}</span>`;
  }
  function showToast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function showView(name) {
    const map = { home: "homeView", list: "listView", new: "editView", detail: "detailView", post: "postView", settings: "settingsView" };
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    $(map[name] || "homeView").classList.add("active");
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.go === name || (name === "new" && b.dataset.go === "new")));
    if (name === "home") renderHome();
    if (name === "list") renderList();
    if (name === "settings") loadTemplates();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function photoUrl(blob) {
    if (!blob) return "";
    return URL.createObjectURL(blob);
  }
  function recordCard(record) {
    const image = record.photo ? `<img src="${photoUrl(record.photo)}" alt="">` : `<div class="no-photo" aria-hidden="true">🍽️</div>`;
    return `<article class="record-card" role="button" tabindex="0" data-record-id="${escapeHtml(record.id)}">
      ${image}<div class="record-main"><h3>${escapeHtml(record.shopName)}</h3>
      <p>${escapeHtml(record.visitDate || "")}${record.menuName ? " ・ " + escapeHtml(record.menuName) : ""}</p>
      <p>${escapeHtml(record.area || "")}</p>${statusBadge(record.postStatus)}</div></article>`;
  }
  async function renderHome() {
    const records = await FoodDB.getAllRecords();
    records.sort((a,b) => (b.visitDate || "").localeCompare(a.visitDate || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    $("pendingCount").textContent = records.filter(r => r.postStatus !== "posted").length;
    $("totalCount").textContent = records.length;
    $("recentRecords").innerHTML = records.slice(0,5).map(recordCard).join("");
    $("homeEmpty").classList.toggle("hidden", records.length !== 0);
    $("recentRecords").classList.toggle("hidden", records.length === 0);
    bindRecordCards("recentRecords");
  }
  async function renderList() {
    const query = $("searchInput").value.trim().toLocaleLowerCase();
    const status = $("statusFilter").value;
    const sort = $("sortOrder").value;
    let records = await FoodDB.getAllRecords();
    records = records.filter(r => {
      const haystack = [r.shopName,r.area,r.menuName,r.tasteMemo,r.volumeMemo,r.atmosphereMemo,r.freeMemo].join(" ").toLocaleLowerCase();
      return (!query || haystack.includes(query)) && (status === "all" || r.postStatus === status);
    });
    records.sort((a,b) => sort === "oldest" ? (a.visitDate || "").localeCompare(b.visitDate || "") : (b.visitDate || "").localeCompare(a.visitDate || ""));
    $("allRecords").innerHTML = records.map(recordCard).join("");
    $("listEmpty").classList.toggle("hidden", records.length !== 0);
    bindRecordCards("allRecords");
  }
  function bindRecordCards(container) {
    $(container).querySelectorAll("[data-record-id]").forEach(card => {
      const open = () => openDetail(card.dataset.recordId);
      card.addEventListener("click", open);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  async function refreshLists() {
    await renderHome();
    await renderList();
    bindRecordCards("recentRecords");
    bindRecordCards("allRecords");
  }
  function clearPhotoPreview() {
    if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
    selectedPhotoUrl = null;
    $("photoPreviewWrap").classList.add("hidden");
    $("photoPreview").removeAttribute("src");
  }
  function setPhoto(blob) {
    selectedPhotoBlob = blob || null;
    clearPhotoPreview();
    if (selectedPhotoBlob) {
      selectedPhotoUrl = URL.createObjectURL(selectedPhotoBlob);
      $("photoPreview").src = selectedPhotoUrl;
      $("photoPreviewWrap").classList.remove("hidden");
      $("checkPhoto").checked = true;
    }
  }
  function resetForm() {
    $("recordForm").reset();
    $("recordId").value = "";
    $("visitDate").value = today();
    $("postStatus").value = "pending";
    $("editHeading").textContent = "新しい記録";
    selectedPhotoBlob = null;
    clearPhotoPreview();
    activeRecordId = null;
  }
  async function editRecord(id) {
    resetForm();
    if (id) {
      const r = await FoodDB.getRecord(id);
      if (!r) return showToast("記録が見つかりません。");
      activeRecordId = id;
      $("editHeading").textContent = "記録を編集";
      $("recordId").value = r.id;
      $("visitDate").value = r.visitDate || today();
      $("shopName").value = r.shopName || "";
      $("area").value = r.area || "";
      $("menuName").value = r.menuName || "";
      $("price").value = r.price ?? "";
      $("tasteMemo").value = r.tasteMemo || "";
      $("volumeMemo").value = r.volumeMemo || "";
      $("atmosphereMemo").value = r.atmosphereMemo || "";
      $("freeMemo").value = r.freeMemo || "";
      $("postStatus").value = r.postStatus || "pending";
      $("snsType").value = r.snsType || "";
      $("postDate").value = r.postDate || "";
      $("checkTaste").checked = !!r.checkTaste;
      $("checkVolume").checked = !!r.checkVolume;
      $("checkAtmosphere").checked = !!r.checkAtmosphere;
      $("checkPrice").checked = !!r.checkPrice;
      $("checkPhoto").checked = !!r.checkPhoto || !!r.photo;
      setPhoto(r.photo || null);
    }
    showView("new");
  }
  function formatPrice(price) {
    return price === "" || price === null || price === undefined ? "" : `${Number(price).toLocaleString("ja-JP")}円`;
  }
  function detailField(label, value) {
    if (!value && value !== 0) return "";
    return `<div class="detail-field"><strong>${label}</strong><p>${escapeHtml(value)}</p></div>`;
  }
  async function openDetail(id) {
    const r = await FoodDB.getRecord(id);
    if (!r) return showToast("記録が見つかりません。");
    activeRecordId = id;
    const image = r.photo ? `<img class="detail-photo" src="${photoUrl(r.photo)}" alt="${escapeHtml(r.shopName)}の写真">` : "";
    $("recordDetail").innerHTML = `${image}
      <div class="detail-panel"><h2>${escapeHtml(r.shopName)}</h2>${statusBadge(r.postStatus)}
      ${detailField("訪問日",r.visitDate)}${detailField("地域・住所",r.area)}${detailField("料理",r.menuName)}${detailField("価格",formatPrice(r.price))}
      ${detailField("味・食感",r.tasteMemo)}${detailField("ボリューム・量",r.volumeMemo)}${detailField("店内の雰囲気・サービス",r.atmosphereMemo)}${detailField("自由メモ",r.freeMemo)}
      ${detailField("SNS",r.snsType)}${detailField("投稿日時",r.postDate ? r.postDate.replace("T"," ") : "")}</div>
      <div class="button-row"><button id="detailMakePost" class="primary">投稿文を作成</button><button id="detailEdit" class="secondary">編集</button><button id="detailDelete" class="danger">削除</button></div>`;
    $("detailMakePost").onclick = () => openPost(r.id);
    $("detailEdit").onclick = () => editRecord(r.id);
    $("detailDelete").onclick = async () => {
      if (confirm("この記録を削除しますか？この操作は取り消せません。")) {
        await FoodDB.deleteRecord(r.id); showToast("記録を削除しました。"); showView("list"); await refreshLists();
      }
    };
    showView("detail");
  }
  function recordToTemplate(r, template) {
    const values = {
      "店名": r.shopName || "", "地域": r.area || "", "訪問日": r.visitDate || "",
      "料理": r.menuName || "", "価格": formatPrice(r.price),
      "味": r.tasteMemo || "", "ボリューム": r.volumeMemo || "",
      "雰囲気": r.atmosphereMemo || "", "メモ": r.freeMemo || ""
    };
    let result = template.replace(/\{([^}]+)\}/g, (all,key) => Object.prototype.hasOwnProperty.call(values,key) ? values[key] : all);
    result = result.split("\n").map(line => line.trim()).filter(line => line.length > 0).join("\n");
    return result.replace(/\n{3,}/g,"\n\n").trim();
  }
  async function loadTemplates() {
    $("reviewTemplate").value = (await FoodDB.getSetting("reviewTemplate")) || DEFAULT_REVIEW;
    $("shortTemplate").value = (await FoodDB.getSetting("shortTemplate")) || DEFAULT_SHORT;
  }
  async function openPost(id) {
    const r = await FoodDB.getRecord(id);
    if (!r) return showToast("記録が見つかりません。");
    postRecordId = id;
    const review = (await FoodDB.getSetting("reviewTemplate")) || DEFAULT_REVIEW;
    const short = (await FoodDB.getSetting("shortTemplate")) || DEFAULT_SHORT;
    $("templateSelect").value = "review";
    $("postText").value = recordToTemplate(r, review);
    $("copyMessage").classList.add("hidden");
    if (r.postStatus === "pending") {
      r.postStatus = "draft"; r.updatedAt = new Date().toISOString(); await FoodDB.putRecord(r);
      await refreshLists();
    }
    showView("post");
  }
  async function refreshPostText() {
    if (!postRecordId) return;
    const r = await FoodDB.getRecord(postRecordId);
    if (!r) return;
    const key = $("templateSelect").value === "short" ? "shortTemplate" : "reviewTemplate";
    const template = (await FoodDB.getSetting(key)) || (key === "shortTemplate" ? DEFAULT_SHORT : DEFAULT_REVIEW);
    $("postText").value = recordToTemplate(r, template);
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("写真を読み込めませんでした。"));
      reader.readAsDataURL(blob);
    });
  }
  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const mime = (parts[0].match(/data:(.*?);base64/) || [,"application/octet-stream"])[1];
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  async function exportBackup() {
    const records = await FoodDB.getAllRecords();
    const serialized = [];
    for (const r of records) {
      const copy = { ...r };
      if (copy.photo) copy.photoDataUrl = await blobToDataUrl(copy.photo);
      delete copy.photo;
      serialized.push(copy);
    }
    const data = {
      format: "FoodWalkNotebookBackup",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: serialized,
      settings: {
        reviewTemplate: (await FoodDB.getSetting("reviewTemplate")) || DEFAULT_REVIEW,
        shortTemplate: (await FoodDB.getSetting("shortTemplate")) || DEFAULT_SHORT
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `foodwalk-backup-${today()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast("バックアップファイルを作成しました。");
  }
  async function importBackup(file) {
    if (!file) return;
    if (!confirm("バックアップを復元すると、現在の記録はすべて置き換わります。続けますか？")) { $("importBackup").value = ""; return; }
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== "FoodWalkNotebookBackup" || !Array.isArray(data.records)) throw new Error("対応していないバックアップ形式です。");
      const records = data.records.map(r => {
        const copy = { ...r };
        if (copy.photoDataUrl) { copy.photo = dataUrlToBlob(copy.photoDataUrl); delete copy.photoDataUrl; }
        if (!copy.id || !copy.shopName) throw new Error("店名または記録IDがないデータが含まれています。");
        return copy;
      });
      await FoodDB.replaceAllRecords(records);
      if (data.settings) {
        if (data.settings.reviewTemplate) await FoodDB.putSetting("reviewTemplate", data.settings.reviewTemplate);
        if (data.settings.shortTemplate) await FoodDB.putSetting("shortTemplate", data.settings.shortTemplate);
      }
      showToast(`${records.length}件の記録を復元しました。`);
      await refreshLists();
    } catch (e) {
      alert(`復元できませんでした。\n${e.message || e}`);
    } finally {
      $("importBackup").value = "";
    }
  }
  async function saveRecord(event) {
    event.preventDefault();
    const id = $("recordId").value || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const old = await FoodDB.getRecord(id);
    let status = $("postStatus").value;
    let postDate = $("postDate").value;
    if (status === "posted" && !postDate) postDate = new Date().toISOString().slice(0,16);
    if (status !== "posted" && !old) postDate = "";
    const record = {
      id, visitDate: $("visitDate").value, shopName: $("shopName").value.trim(),
      area: $("area").value.trim(), menuName: $("menuName").value.trim(),
      price: $("price").value === "" ? "" : Number($("price").value),
      tasteMemo: $("tasteMemo").value.trim(), volumeMemo: $("volumeMemo").value.trim(),
      atmosphereMemo: $("atmosphereMemo").value.trim(), freeMemo: $("freeMemo").value.trim(),
      checkTaste: $("checkTaste").checked, checkVolume: $("checkVolume").checked,
      checkAtmosphere: $("checkAtmosphere").checked, checkPrice: $("checkPrice").checked,
      checkPhoto: $("checkPhoto").checked, photo: selectedPhotoBlob || (old ? old.photo : null),
      postStatus: status, snsType: $("snsType").value, postDate,
      createdAt: old ? old.createdAt : new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    await FoodDB.putRecord(record);
    showToast("記録を保存しました。");
    resetForm();
    await refreshLists();
    showView("detail");
    await openDetail(id);
  }

  async function init() {
    try { await FoodDB.openDb(); }
    catch (e) { alert("保存領域を初期化できませんでした。ブラウザ設定をご確認ください。\n" + e.message); return; }

    document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", async () => {
      const go = btn.dataset.go;
      if (go === "new") await editRecord(null);
      else if (go === "post") {
        const records = await FoodDB.getAllRecords();
        const first = records.filter(r => r.postStatus !== "posted").sort((a,b) => (a.visitDate||"").localeCompare(b.visitDate||""))[0];
        if (!first) { showView("list"); showToast("未投稿の記録がありません。"); }
        else await openPost(first.id);
      } else showView(go);
    }));
    $("newRecordTop").onclick = () => editRecord(null);
    $("newRecordMain").onclick = () => editRecord(null);
    $("cancelEdit").onclick = () => showView("home");
    $("backToList").onclick = () => showView("list");
    $("cancelPost").onclick = () => activeRecordId ? openDetail(activeRecordId) : showView("list");
    $("recordForm").addEventListener("submit", saveRecord);
    $("photoInput").addEventListener("change", async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { showToast("画像ファイルを選択してください。"); return; }
      if (file.size > 15 * 1024 * 1024 && !confirm("写真が15MBを超えています。保存容量を多く使います。続けますか？")) { e.target.value = ""; return; }
      setPhoto(file);
    });
    $("removePhoto").onclick = () => { setPhoto(null); $("photoInput").value = ""; $("checkPhoto").checked = false; };
    $("searchInput").addEventListener("input", renderList);
    $("statusFilter").addEventListener("change", renderList);
    $("sortOrder").addEventListener("change", renderList);
    $("templateSelect").addEventListener("change", refreshPostText);
    $("copyPost").onclick = async () => {
      try {
        await navigator.clipboard.writeText($("postText").value);
        $("copyMessage").classList.remove("hidden"); showToast("投稿文をコピーしました。");
      } catch {
        $("postText").focus(); $("postText").select();
        const ok = document.execCommand("copy");
        if (ok) { $("copyMessage").classList.remove("hidden"); showToast("投稿文をコピーしました。"); }
        else showToast("文章を選択して手動でコピーしてください。");
      }
    };
    $("markPosted").onclick = async () => {
      if (!postRecordId) return;
      const r = await FoodDB.getRecord(postRecordId);
      if (!r) return;
      r.postStatus = "posted"; r.postDate = new Date().toISOString().slice(0,16); r.updatedAt = new Date().toISOString();
      await FoodDB.putRecord(r); await refreshLists(); showToast("投稿済みにしました。"); await openDetail(r.id);
    };
    $("exportBackup").onclick = exportBackup;
    $("importBackup").addEventListener("change", e => importBackup(e.target.files && e.target.files[0]));
    $("saveTemplates").onclick = async () => {
      await FoodDB.putSetting("reviewTemplate", $("reviewTemplate").value);
      await FoodDB.putSetting("shortTemplate", $("shortTemplate").value);
      showToast("テンプレートを保存しました。");
    };
    $("deleteAll").onclick = async () => {
      if (confirm("すべての記録を削除します。この操作は取り消せません。事前にバックアップしましたか？")) {
        if (confirm("本当にすべての記録を削除しますか？")) {
          await FoodDB.deleteAllRecords(); await refreshLists(); showView("home"); showToast("すべての記録を削除しました。");
        }
      }
    };

    await loadTemplates();
    await refreshLists();
    showView("home");
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./service-worker.js").catch(err => console.warn("Service Worker registration failed", err));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
