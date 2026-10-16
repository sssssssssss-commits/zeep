const TOKEN_KEY = "rail_pair_token";
const CODE_KEY = "rail_pair_code";
const EXPIRES_KEY = "rail_pair_expires";

const el = (id) => document.getElementById(id);

function headers() {
  const token = localStorage.getItem(TOKEN_KEY);
  const h = {};
  if (token) h["X-Pair-Token"] = token;
  return h;
}

async function ensurePair(force = false) {
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0);
  if (
    !force &&
    localStorage.getItem(TOKEN_KEY) &&
    localStorage.getItem(CODE_KEY) &&
    expiresAt > Date.now() / 1000
  ) {
    el("pair-code").textContent = localStorage.getItem(CODE_KEY);
    return;
  }
  const res = await fetch("/api/pair", {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error("创建配对失败");
  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(CODE_KEY, data.code);
  localStorage.setItem(EXPIRES_KEY, String(data.expires_at));
  el("pair-code").textContent = data.code;
}

function fillForm(fields) {
  const form = el("trip-form");
  for (const [k, v] of Object.entries(fields || {})) {
    if (form.elements[k]) form.elements[k].value = v || "";
  }
  el("form-panel").hidden = false;
}

async function refreshTrips() {
  const list = el("trip-list");
  list.innerHTML = "";
  const res = await fetch("/api/trips", { headers: headers() });
  if (!res.ok) {
    list.innerHTML = "<li>暂无行程或配对失效，请刷新配对码</li>";
    return;
  }
  const data = await res.json();
  if (!data.trips?.length) {
    list.innerHTML = "<li>还没有确认的行程</li>";
    return;
  }
  for (const t of data.trips) {
    const li = document.createElement("li");
    li.textContent = `${t.date} ${t.train_no} ${t.from_station}→${t.to_station} ${t.depart_time} 检票口${t.gate || "-"} ${t.carriage || ""}车${t.seat || ""}`;
    list.appendChild(li);
  }
}

el("btn-new-pair").addEventListener("click", async () => {
  try {
    await ensurePair(true);
    await refreshTrips();
  } catch (e) {
    alert(e.message || String(e));
  }
});

el("btn-refresh").addEventListener("click", () => refreshTrips());

el("file").addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  el("ocr-status").textContent = "识别中…";
  try {
    await ensurePair();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    if (!res.ok) throw new Error("识别失败");
    const data = await res.json();
    fillForm(data.fields);
    const raw = el("raw-text");
    if (data.raw_text) {
      raw.hidden = false;
      raw.textContent = `引擎: ${data.engine}\n${data.raw_text}`;
    } else {
      raw.hidden = true;
      el("ocr-status").textContent =
        data.engine === "none" || data.engine === "mock"
          ? "未启用 OCR，请手填字段后确认"
          : "未识别出文字，请手填";
      return;
    }
    el("ocr-status").textContent = "请核对后确认保存";
  } catch (e) {
    el("ocr-status").textContent = e.message || String(e);
  } finally {
    ev.target.value = "";
  }
});

el("trip-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    await ensurePair();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t);
    }
    alert("已保存。手表连接手机后在小程序内刷新即可同步。");
    ev.target.reset();
    el("form-panel").hidden = true;
    await refreshTrips();
  } catch (e) {
    alert("保存失败: " + (e.message || String(e)));
  }
});

ensurePair()
  .then(refreshTrips)
  .catch((e) => {
    el("pair-code").textContent = "错误";
    el("ocr-status").textContent = e.message || String(e);
  });
