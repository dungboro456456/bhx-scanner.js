(async function initBHXScanner() {
    function showToast(message, isError = false) {
        let toast = document.createElement("div");
        toast.innerHTML = message;
        toast.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); background:${isError ? '#e74c3c' : '#2ecc71'}; color:#fff; padding:12px 20px; border-radius:8px; z-index:9999999; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3); font-size:14px; text-align:center; width:85%; max-width:350px; font-family:Arial;`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    if (window.location.hostname !== "www.bachhoaxanh.com") {
        showToast("🛑 Vui lòng chạy trên web Bách Hóa Xanh!", true);
        return;
    }

    let pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) {
        showToast("🛑 Hãy mở một sản phẩm cụ thể rồi chạy tool.", true);
        return;
    }

    const CATEGORY_URL = pathParts[0];
    const PRODUCT_URL = pathParts[1];
    const PRODUCT_NAME = document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : PRODUCT_URL;

    const oldOverlay = document.getElementById("bhx-overlay-pro");
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement("div");
    overlay.id = "bhx-overlay-pro";
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999998; display:flex; justify-content:center; align-items:center; font-family:Arial;";
    
    const modal = document.createElement("div");
    modal.style.cssText = "background:#fff; padding:20px; border-radius:12px; width:90%; max-width:420px; box-shadow:0 10px 25px rgba(0,0,0,0.3); box-sizing:border-box;";
    modal.innerHTML = `<h3 style="margin:0 0 10px;color:#2c3e50;">⏳ Đang kết nối máy chủ...</h3>`;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    try {
        const res = await fetch("https://api.bachhoaxanh.com/gw/LocationV3/GetFull", {
            headers: { platform: "webnew", xapikey: "bhx-api-core-2022" }
        });
        const json = await res.json();
        
        let rawData = json?.data || json?.Value || json || [];
        if (!Array.isArray(rawData)) {
            rawData = rawData.ListProvince || rawData.provinces || Object.values(rawData).filter(i => i && (i.id || i.provinceId));
        }

        let provinces = rawData.map(p => ({
            id: p.id || p.provinceId || p.Id,
            name: p.name || p.provinceName || p.Name
        })).filter(p => p.id && p.name);

        provinces.sort((a, b) => {
            if (a.id == 1027) return -1;
            if (b.id == 1027) return 1;
            return a.name.localeCompare(b.name);
        });

        let optionsHTML = provinces.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        modal.innerHTML = `
            <h3 style="margin:0 0 10px; color:#2c3e50; font-size:16px;">🎯 SP: ${PRODUCT_NAME}</h3>
            <label style="font-size:13px; color:#555; font-weight:bold;">📍 Chọn Khu Vực Quét:</label>
            <select id="bhx-sel" style="width:100%; padding:10px; font-size:14px; border:2px solid #bdc3c7; border-radius:8px; outline:none; margin-top:8px;">
                ${optionsHTML}
            </select>
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button id="bhx-btn-cancel" style="padding:10px; border:none; background:#e74c3c; color:#fff; border-radius:6px; flex:1; font-weight:bold; cursor:pointer;">Đóng</button>
                <button id="bhx-btn-start" style="padding:10px; border:none; background:#2ecc71; color:#fff; border-radius:6px; flex:1.5; font-weight:bold; cursor:pointer;">🚀 Quét Ngay (Tối đa 2000 CH)</button>
            </div>
        `;

        document.getElementById("bhx-btn-cancel").onclick = () => overlay.remove();
        document.getElementById("bhx-btn-start").onclick = () => {
            let sel = document.getElementById("bhx-sel");
            let pId = parseInt(sel.value);
            let pName = sel.options[sel.selectedIndex].text;
            startScan(pId, pName);
        };

    } catch (e) {
        modal.innerHTML = `<h3 style="color:#c0392b;">❌ Lỗi: ${e.message}</h3><button onclick="document.getElementById('bhx-overlay-pro').remove()" style="padding:10px; background:#e74c3c; color:#fff; border:none; border-radius:6px; width:100%;">Đóng</button>`;
    }

    async function startScan(pId, pName) {
        modal.innerHTML = `<div style="text-align:center;"><h3 style="color:#3498db; margin:0 0 5px;">⏳ Đang cào toàn bộ danh sách chi nhánh...</h3><p style="font-size:12px; color:#555;">Khu vực: ${pName} (Giới hạn tối đa 2000 CH)</p></div>`;
        
        let stores = [];
        let page = 0;
        const config = {
            headers: { accept: "application/json", platform: "webnew", xapikey: "bhx-api-core-2022", "cache-control": "no-cache" }
        };

        while (true) {
            try {
                let r = await fetch(`https://api.bachhoaxanh.com/gw/Location/V2/GetStoresByLocation?provinceId=${pId}&wardId=0&pageSize=100&pageIndex=${page}`, config);
                let j = await r.json();
                let d = j?.data?.stores || j?.Value?.stores || [];
                if (d.length === 0) break;
                stores.push(...d);
                if (stores.length >= 2000) break;
                page++;
            } catch (e) { break; }
        }
        
        stores = stores.slice(0, 2000);
        if (stores.length === 0) {
            modal.innerHTML = `<h3 style="color:#e74c3c;">❌ Không có chi nhánh nào!</h3><button onclick="document.getElementById('bhx-overlay-pro').remove()" style="padding:10px; background:#e74c3c; color:#fff; border:none; border-radius:6px; width:100%; margin-top:10px;">Đóng</button>`;
            return;
        }

        modal.innerHTML = `<div style="text-align:center;"><h3 style="color:#3498db; margin:0 0 5px;">⚡ Đang quét tồn kho ${stores.length} chi nhánh...</h3><p style="font-size:12px; color:#555;">Đa luồng đang chạy tốc độ cao</p></div>`;

        async function check(s) {
            try {
                let r = await fetch(`https://api.bachhoaxanh.com/gw/Product/GetProductDetail?provinceId=${pId}&wardId=${s.wardId}&districtId=${s.districtId||0}&storeId=${s.storeId}&CategoryUrl=${CATEGORY_URL}&ProductUrl=${PRODUCT_URL}&_t=${Date.now()}`, config);
                let j = await r.json();
                let p = (j?.data?.boxBuys?.[0]?.productPrices?.[0]) || {};
                
                let isOk = p.isBuy === true || p.isCanBuy === true || p.status === 1;
                let prc = p.price || p.salePrice || 0;
                
                return { 
                    id: s.storeId, 
                    address: s.storeLocation || s.storeAddress, 
                    isAvail: isOk, 
                    rawPrice: prc,
                    priceTxt: (isOk && prc > 0) ? prc.toLocaleString() + 'đ' : "---" 
                };
            } catch (e) {
                return { id: s.storeId, address: s.storeLocation || "", isAvail: false, rawPrice: 99999999, priceTxt: "---" };
            }
        }

        let results = [];
        for (let i = 0; i < stores.length; i += 20) {
            let batch = stores.slice(i, i + 20);
            results.push(...(await Promise.all(batch.map(s => check(s)))));
        }

        // Sắp xếp: Còn hàng lên trước, sau đó xếp giá từ Thấp đến Cao
        results.sort((a, b) => {
            if (a.isAvail !== b.isAvail) return a.isAvail ? -1 : 1;
            return a.rawPrice - b.rawPrice;
        });

        let inStockCount = results.filter(x => x.isAvail).length;

        let rowsHTML = results.map(r => `
            <tr style="border-bottom:1px solid #eee; font-size:12px;">
                <td style="padding:6px; color:#2980b9; font-weight:bold; cursor:pointer;" onclick="navigator.clipboard.writeText('${r.id}'); window.showToastCopy('Đã copy Mã CH: ${r.id}')" title="Chạm để copy mã">${r.id}</td>
                <td style="padding:6px; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;" onclick="navigator.clipboard.writeText(this.innerText); window.showToastCopy('Đã copy Địa chỉ!')" title="Chạm để copy địa chỉ">${r.address}</td>
                <td style="padding:6px; font-weight:bold; color:${r.isAvail ? '#27ae60' : '#e74c3c'}">${r.isAvail ? 'CÒN' : 'HẾT'}</td>
                <td style="padding:6px; font-weight:bold; color:#d35400;">${r.priceTxt}</td>
            </tr>
        `).join('');

        window.showToastCopy = (msg) => showToast(msg, false);

        modal.style.width = "95%";
        modal.style.maxWidth = "460px";
        modal.innerHTML = `
            <h3 style="margin:0 0 5px; font-size:15px;">📊 Báo Cáo: ${inStockCount}/${results.length} KHO CÒN HÀNG</h3>
            <p style="margin:0 0 10px; font-size:11px; color:#e67e22;">💡 Mẹo: Chạm vào Mã CH hoặc Địa chỉ để copy nhanh!</p>
            <div style="max-height:280px; overflow-y:auto; border:1px solid #ddd; border-radius:6px; margin-bottom:15px;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:#f1f2f6; position:sticky; top:0;">
                        <tr>
                            <th style="padding:8px 6px;">Mã</th>
                            <th style="padding:8px 6px;">Chi Nhánh</th>
                            <th style="padding:8px 6px;">Kho</th>
                            <th style="padding:8px 6px;">Giá (Thấp➔Cao)</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="bhx-btn-close-final" style="padding:10px; background:#e74c3c; color:#fff; border:none; border-radius:6px; flex:1; font-weight:bold; cursor:pointer;">Đóng</button>
                <button id="bhx-btn-dl" style="padding:10px; background:#3498db; color:#fff; border:none; border-radius:6px; flex:1; font-weight:bold; cursor:pointer;">📥 Tải CSV</button>
            </div>
        `;

        document.getElementById("bhx-btn-close-final").onclick = () => overlay.remove();
        document.getElementById("bhx-btn-dl").onclick = () => {
            let csv = "data:text/csv;charset=utf-8,\uFEFFMã Cửa Hàng,Chi Nhánh,Trạng Thái,Giá Bán\n";
            results.forEach(r => {
                csv += `${r.id},"${r.address.replace(/"/g, '""')}",${r.isAvail ? 'CÒN HÀNG' : 'HẾT HÀNG'},${r.priceTxt}\n`;
            });
            let link = document.createElement("a");
            link.href = encodeURI(csv);
            link.download = `TonKho_${PRODUCT_URL.substring(0, 15)}_${Date.now()}.csv`;
            document.body.appendChild(link); link.click(); link.remove();
        };
    }
})();
