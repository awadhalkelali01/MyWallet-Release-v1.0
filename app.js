// app.js: منطق عرض إجمالي الأصول في لوحة التحكم الرئيسية

const showDuration = 1500; 
const cards = Array.from(document.querySelectorAll('.card'));
const updateLink = document.getElementById('updateLink');

// عناصر عرض المبالغ
const totalYerEl = document.getElementById('total-yer');
const totalSarEl = document.getElementById('total-sar');
const totalUsdEl = document.getElementById('total-usd');

// ------------------------------------------------------------------
// 1. منطق عرض البيانات (مع caching كامل)
// ------------------------------------------------------------------

/**
 * يحسب ويُحدّث إجمالي الأرصدة.
 * إذا تم استدعاؤه بـ withCache=true، سيعرض من sessionStorage فقط.
 */
async function displayTotalAssets(withCache = true) {

    // ----------------------------------------------------
    // ١) إذا مسموح بالكاش ووجدناه → نعرضه فوراً
    // ----------------------------------------------------
    if (withCache) {
        const cachedTotals = sessionStorage.getItem("cachedTotals");
        if (cachedTotals) {
            const totals = JSON.parse(cachedTotals);

            totalYerEl.textContent = totals.yer;
            totalSarEl.textContent = totals.sar;
            totalUsdEl.textContent = totals.usd;

            return;
        }
    }

    // ----------------------------------------------------
    // ٢) لا يوجد كاش → حساب فعلي
    // ----------------------------------------------------
    await waitForRates(); 
    
    const assets = await getAllData('assets');
    
    let totalYER = 0;
    
    assets.forEach(asset => {
        totalYER += convertToYER(asset.value, asset.currency, asset.type);
    });

    const totalUSD = totalYER / currentRates.USD_TO_YER;
    const totalSAR = totalYER / currentRates.SAR_TO_YER;

    // تنسيق
    const formatted = {
        yer: totalYER.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " YER",
        sar: totalSAR.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " SAR",
        usd: totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " USD"
    };

    // عرض القيم
    totalYerEl.textContent = formatted.yer;
    totalSarEl.textContent = formatted.sar;
    totalUsdEl.textContent = formatted.usd;

    // ----------------------------------------------------
    // ٣) تخزين النتيجة في الكاش (للاستخدام السريع عند الرجوع)
    // ----------------------------------------------------
    sessionStorage.setItem("cachedTotals", JSON.stringify(formatted));
}

// ------------------------------------------------------------------
// 2. عنوان آخر تحديث
// ------------------------------------------------------------------

async function updateLastUpdateLabels() {
    try {
        const rates = await getAllData('rates');
        const lastUpdate = rates.find(r => r.key === 'LAST_UPDATE');

        const labels = document.querySelectorAll('.card-update');

        if (!lastUpdate || labels.length === 0) return;

        const date = new Date(lastUpdate.value);

        const formatted = date.toLocaleString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });

        labels.forEach(el => el.textContent = "آخر تحديث: " + formatted);

    } catch (e) {
        console.error("Update label error", e);
    }
}

// ------------------------------------------------------------------
// 3. تسلسل ظهور البطاقات
// ------------------------------------------------------------------

function startCardsSequence(){
    cards.forEach((c) => {
      c.style.opacity = '1'; 
      c.style.transform = 'translateY(0)';
      c.style.transition = 'opacity .6s ease, transform .6s ease';
    });

    if(updateLink) {
        updateLink.style.opacity = '1';
        updateLink.style.transform = 'translateY(0)';
    }
}

// ------------------------------------------------------------------
// 4. تسلسل التحميل عند فتح الصفحة
// ------------------------------------------------------------------

function handleLoadSequence() {

    const cached = sessionStorage.getItem("cachedTotals");

    // ----------------------------------------------------
    // ١) إذا يوجد كاش → نعرض فوراً بدون انتظار
    // ----------------------------------------------------
    if (cached) {
        displayTotalAssets(true);
        updateLastUpdateLabels();
        startCardsSequence();
        return;
    }

    // ----------------------------------------------------
    // ٢) لا يوجد كاش → أول تشغيل → حساب فعلي
    // ----------------------------------------------------
    setTimeout(async () => {

        await displayTotalAssets(false);  // ← حساب وتخزين
        await updateLastUpdateLabels();
        startCardsSequence();

    }, showDuration);
}

// ------------------------------------------------------------------
// بدء التشغيل
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', handleLoadSequence);
