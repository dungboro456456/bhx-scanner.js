(async function initBHXScanner() {
    // 1. HỆ THỐNG THÔNG BÁO (TOAST UI)
    function showToast(message, isError = false) {
        let toast = document.createElement("div");
        toast.innerHTML = message;
        toast.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); background:${isError ? '#e74c3c' : '#2ecc71'}; color:#fff; padding:12px 20px; border-radius:8px; z-index:9999999; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3); font-size:14px; text-align:center; width:85%; max-width:350px; font-family:Arial;`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    // Hàm hỗ trợ copy nhanh khi chạm vào text trên điện thoại
    window.bhxCopyText = function(text, label) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(`Đã copy ${label}: <b>${text}</b>`);
            }).catch(() => {
                fallbackCopy(text, label);
            });
        } else {
            fallbackCopy(text, label);
        }
    };

    function fallbackCopy(text, label) {
        let textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(`Đã copy ${label}: <b>${text}</b>`);
        } catch (err) {
            showToast(`Không thể copy!`, true);
        }
        document.body.removeChild(textArea);
    }

    if (window.location.hostname !== "www.bachhoaxanh.com") {
        showToast("🛑 Vui lòng chạy trên web Bách Hóa Xanh!", true);
        return;
    }

    let pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) {
        showToast("🛑 Hãy ấn vào 1 sản phẩm cụ thể rồi chạy tool.", true);
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
    modal.style.cssText = "background:#fff; padding:20px; border-radius:12px; width:95%; max-width:450px; box-shadow:0 10px 25px rgba(0,0,0,0.3); box-sizing:border-box;";
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
            if (a.id == 1027) return 1;
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
                <button id="bhx-btn-start" style="padding:10px; border:none; background:#2ecc71; color:#fff; border-radius:6px; flex:1.5; font-weight:bold; cursor:pointer;">🚀 Quét Ngay</button>
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
        modal.innerHTML = `<div style="text-align:center;"><h3 style="color:#3498db; margin:0 0 5px;">⏳ Đang quét toàn bộ chi nhánh...</h3><p style="font-size:12px; color:#555;">Khu vực: ${pName} (Tối đa 2000 CH)</p></div>`;
        
        let stores = [];
        let page = 0;
        const config = {
            headers: { accept: "application/json", platform: "webnew", xapikey: "bhx-api-core-2022", "cache-control": "no-cache" }
        };

        // Nâng giới hạn quét lên 2000 cửa hàng
        while (stores.length < 2000) {
            try {
                let r = await fetch(`https://api.bachhoaxanh.com/gw/Location/V2/GetStoresByLocation?provinceId=${pId}&wardId=0&pageSize=50&pageIndex=${page}`, config);
                let j = await r.json();
                let d = j?.data?.stores || j?.Value?.stores || [];
                if (d.length === 0) break;
                stores.push(...d);
                page++;
            } catch (e) { break; }
        }

        if (stores.length === 0) {
            modal.innerHTML = `<h3 style="color:#e74c3c;">❌ Không có chi nhánh nào!</h3><button onclick="document.getElementById('bhx-overlay-pro').remove()" style="padding:10px; background:#e74c3c; color:#fff; border-radius:6px; width:100%; margin-top:10px;">Đóng</button>`;
            return;
        }

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
                return { id: s.storeId, address: s.storeLocation || '', isAvail: false, rawPrice: 999999999, priceTxt: "---" };
            }
        }

        // Tăng luồng lên 20 để quét hơn ngàn cửa hàng nhanh chóng hơn
        let results = [];
        for (let i = 0; i < stores.length; i += 20) {
            let batch = stores.slice(i, i + 20);
            results.push(...(await Promise.all(batch.map(s => check(s)))));
        }

        // Sắp xếp ưu tiên: Còn hàng lên trên, sau đó xếp theo giá từ thấp đến cao (Săn lỗi giá / deal sốc)
        results.sort((a, b) => {
            if (a.isAvail !== b.isAvail) return a.isAvail ? -1 : 1;
            return a.rawPrice - b.rawPrice;
        });

        let inStockCount = results.filter(x => x.isAvail).length;

        // In toàn bộ kết quả ra bảng, thêm sự kiện click/chạm để copy mã và địa chỉ
        let rowsHTML = results.map((r, index) => `
            <tr style="border-bottom:1px solid #eee; font-size:12px;">
                <td style="padding:6px; color:#888; text-align:center;">${index + 1}</td>
                <td style="padding:6px; color:#3498db; font-weight:bold; cursor:pointer;" onclick="bhxCopyText('${r.id}', 'Mã CH')" title="Chạm để copy mã">${r.id}</td>
                <td style="padding:6px; max-width:130px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;" onclick="bhxCopyText('${r.address.replace(/'/g, "\\'")}', 'Địa chỉ')" title="Chạm để copy địa chỉ">${r.address}</td>
                <td style="padding:6px; font-weight:bold; color:${r.isAvail ? '#27ae60' : '#e74c3c'}">${r.isAvail ? 'CÒN' : 'HẾT'}</td>
                <td style="padding:6px; font-weight:bold; color:#e67e22;">${r.priceTxt}</td>
            </tr>
        `).join('');

        modal.style.width = "98%";
        modal.style.maxWidth = "480px";
        modal.innerHTML = `
            <h3 style="margin:0 0 5px; font-size:15px;">📊 Báo Cáo (${inStockCount}/${results.length} Kho còn)</h3>
            <p style="margin:0 0 10px; font-size:11px; color:#e67e22;">💡 <i>Chạm vào [Mã CH] hoặc [Địa chỉ] để copy ngay! Đã sắp xếp giá rẻ lên đầu.</i></p>
            <div style="max-height:320px; overflow-y:auto; border:1px solid #ddd; border-radius:6px; margin-bottom:15px;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:#f1f2f6; position:sticky; top:0; z-index:5;">
                        <tr>
                            <th style="padding:8px 4px; text-align:center;">STT</th>
                            <th style="padding:8px 4px;">Mã</th>
                            <th style="padding:8px 6px;">Chi Nhánh</th>
                            <th style="padding:8px 4px;">Kho</th>
                            <th style="padding:8px 6px;">Giá</th>
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
            let csv = "data:text/csv;charset=utf-8,\uFEFFSTT,Mã Cửa Hàng,Chi Nhánh,Trạng Thái,Giá Bán\n";
            results.forEach((r, idx) => {
                csv += `${idx + 1},${r.id},"${r.address.replace(/"/g, '""')}",${r.isAvail ? 'CÒN HÀNG' : 'HẾT HÀNG'},${r.priceTxt}\n`;
            });
            let link = document.createElement("a");
            link.href = encodeURI(csv);
            link.download = `TonKho_${PRODUCT_URL.substring(0, 15)}_${Date.now()}.csv`;
            document.body.appendChild(link); link.click(); link.remove();
        };
    }
})();
