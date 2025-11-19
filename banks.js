// banks.js: منطق إضافة، عرض، تعديل، وحذف البنوك والأرصدة المتعددة

// الدوال putData, getAllData, deleteBulkData, convertToYER, currentRates, waitForRates, showNotification, convertYERToSAR
// يتم تحميلها من core_logic.js

const openBanksModalBtn = document.getElementById('openBanksModal');
const closeBanksModalBtn = document.getElementById('closeBanksModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const currencyRowsContainer = document.getElementById('currencyRows');
const addRowBtn = document.getElementById('addRowBtn');
const saveBankBtn = document.getElementById('saveBankBtn');
const banksGrid = document.getElementById('banksGrid');
const bankNameInput = document.getElementById('bankName');

const confirmBackdrop = document.getElementById('confirmBackdrop');
const confirmYesBtn = document.getElementById('confirmYes');
const confirmNoBtn = document.getElementById('confirmNo');
const confirmTextEl = document.getElementById('confirmText');

let currentEditBankName = null; 
let initialAssetsIDs = []; // 🆕 قائمة بالـ IDs الأصلية عند فتح المودال
const GOLD_ASSET_NAME = "إجمالي الذهب المحسوب (جرامات)"; 


// ----------------------------------------------------\
// 1. دوال المودال والإدخال
// ----------------------------------------------------\

function openModal(backdrop) {
    backdrop.classList.add('active');
}

function closeModal(backdrop) {
    backdrop.classList.remove('active');
}

// 🆕 تم تعديل دالة addRow لاستقبال ID الرصيد
function addRow(currency = 'YER', value = '', assetId = null) {
    const newRow = document.createElement('div');
    newRow.className = 'currency-row';
    // 🆕 تخزين الـ ID كخاصية data-id مخفية في الصف
    newRow.dataset.id = assetId || ''; 
    
    newRow.innerHTML = `
        <select class="styled-select currency-select">
            <option value="YER" ${currency === 'YER' ? 'selected' : ''}>ريال يمني (YER)</option>
            <option value="SAR" ${currency === 'SAR' ? 'selected' : ''}>ريال سعودي (SAR)</option>
            <option value="USD" ${currency === 'USD' ? 'selected' : ''}>دولار أمريكي (USD)</option>
        </select>
        <input type="number" class="value-input" step="0.01" min="0" placeholder="قيمة الرصيد" value="${value}" required>
        <button type="button" class="btn cancel btn-small remove-row-btn">🗑️</button>
    `;
    currencyRowsContainer.appendChild(newRow);
    
    newRow.querySelector('.remove-row-btn').addEventListener('click', (e) => {
        if (currencyRowsContainer.querySelectorAll('.currency-row').length > 1) {
            newRow.remove();
        } else {
            showNotification('يجب أن يكون هناك رصيد واحد على الأقل.', true);
        }
    });
}

function resetModal() {
    bankNameInput.value = '';
    bankNameInput.disabled = false; 
    currencyRowsContainer.innerHTML = '';
    currentEditBankName = null; 
    initialAssetsIDs = []; // 🆕 إعادة تعيين قائمة الـ IDs
    addRow(); 
}

// ----------------------------------------------------\
// 2. دوال معالجة البيانات (الحفظ والحذف الذكي)
// ----------------------------------------------------\

/**
 * دالة لحذف الأصول المصرفية بناءً على قائمة من الـ IDs.
 */
async function deleteAssetsByIDs(ids) {
    if (!ids || ids.length === 0) return;
    await deleteBulkData('assets', ids);
}

// دالة معالجة الحفظ/الإرسال (تم إعادة كتابتها لتكون أكثر ذكاءً)
saveBankBtn.addEventListener('click', async () => {
    const bankName = bankNameInput.value.trim();
    if (!bankName) {
        showNotification('❌ يرجى إدخال اسم الأصل.', true);
        return;
    }
    
    const rows = currencyRowsContainer.querySelectorAll('.currency-row');
    
    const assetsToSave = [];
    const savedIDs = [];

    // 1. جمع البيانات الجديدة والمُعدّلة
    rows.forEach(row => {
        const currency = row.querySelector('.currency-select').value;
        const value = parseFloat(row.querySelector('.value-input').value);
        // 🆕 قراءة الـ ID المخفي في الصف
        const assetId = row.dataset.id ? parseInt(row.dataset.id) : null; 
        
        if (value > 0 && !isNaN(value)) {
            const asset = {
                name: bankName,
                value: value,
                currency: currency,
                type: 'bank' 
            };
            if (assetId) {
                asset.id = assetId; // لإجراء عملية put/update
                savedIDs.push(assetId);
            }
            assetsToSave.push(asset);
        }
    });
    
    if (assetsToSave.length === 0) {
        showNotification('❌ يرجى إدخال قيمة صحيحة لواحد على الأقل من الأرصدة.', true);
        return;
    }

    try {
        // 2. 🆕 خطوة حاسمة: تحديد الأصول التي تم حذف صفها من المودال
        const idsToDelete = initialAssetsIDs.filter(id => !savedIDs.includes(id));
        
        // 3. تنفيذ الحذف الجماعي للأصول التي لم تعد موجودة في المودال
        if (idsToDelete.length > 0) {
            await deleteAssetsByIDs(idsToDelete);
            console.log(`[Banks] ✅ تم حذف الأصول القديمة بالـ IDs: ${idsToDelete.join(', ')}`);
        }
        
        // 4. إضافة وتحديث الأصول الجديدة بالكامل (باستخدام putData)
        const savePromises = assetsToSave.map(asset => putData('assets', asset));
        await Promise.all(savePromises);
        
        showNotification(`✅ تم حفظ/تحديث الأصل: ${bankName} بنجاح.`);
        closeModal(modalBackdrop);
        await displayBanks(); 
        
    } catch (error) {
        showNotification('❌ فشل في حفظ البيانات. تحقق من Console Browser.', true);
        console.error("Error saving asset with ID-based logic:", error);
    }
});


// ----------------------------------------------------\
// 3. دالة عرض الأصول (DisplayBanks) - (باقية كما هي)
// ----------------------------------------------------\
async function displayBanks() {
    await waitForRates(); 
    const assets = await getAllData('assets');
    
    const banksMap = new Map();
    let goldAsset = null;
    // ... (بقية منطق عرض displayBanks...)
    assets.forEach(asset => {
        if (asset.name === GOLD_ASSET_NAME && asset.type === 'gold') {
            goldAsset = asset;
            return; 
        }
        
        if (!banksMap.has(asset.name)) {
            banksMap.set(asset.name, { name: asset.name, balances: [], totalYER: 0 });
        }
        
        const bank = banksMap.get(asset.name);
        bank.balances.push(asset);
        bank.totalYER += convertToYER(asset.value, asset.currency, asset.type); 
    });

    banksGrid.innerHTML = ''; 

    // **1. عرض بطاقة الذهب (إذا كان موجوداً)**
    if (goldAsset && goldAsset.value > 0) {
        const goldCard = document.createElement('div');
        goldCard.className = 'card gold-card'; 
        
        const totalYER = convertToYER(goldAsset.value, goldAsset.currency, goldAsset.type);
        const totalSAR = convertYERToSAR(totalYER);

const totalUSD = totalYER / currentRates.USD_TO_YER;

goldCard.innerHTML = `
    <div class="card-title" style="color: var(--gold); font-size: 16px;">${goldAsset.name}</div>

    <div class="card-amount" style="font-size: 30px;">
        ${totalYER.toLocaleString(undefined, { maximumFractionDigits: 0 })} YER
    </div>

    <div class="card-content">

        <div style="margin-top: 10px;">
            <p class="card-note">الكمية: ${goldAsset.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} جرام</p>
            <p class="card-note">SAR: ${totalSAR.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            <p class="card-note">USD: ${totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>

    </div>

    <div class="actions-fixed">
        <a href="gold.html" class="btn primary btn-small" style="width: 100%; text-align: center;">💎 إدارة وتعديل الذهب</a>
    </div>
`;


        banksGrid.appendChild(goldCard);
        goldCard.style.opacity = '1';
        goldCard.style.transform = 'translateY(0)';
    }


    // **2. عرض بطاقات الأصول/البنوك الأخرى**
    banksMap.forEach(bank => {
        const bankCard = document.createElement('div');
        bankCard.className = 'card bank-card'; 
        bankCard.dataset.name = bank.name;
        
        const totalSAR = convertYERToSAR(bank.totalYER);
        const totalUSD = bank.totalYER / currentRates.USD_TO_YER;

        let balancesHtml = bank.balances.map(asset => `
            <p class="card-note" style="margin: 2px 0;">
                ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${asset.currency}
            </p>
        `).join('');

bankCard.innerHTML = `
    <div class="card-title">${bank.name}</div>

    <div class="card-amount">
        ${bank.totalYER.toLocaleString(undefined, { maximumFractionDigits: 0 })} YER
    </div>

    <div class="card-content">

        <!-- الأصول الفعلية -->
        <div class="actual-assets">
            ${bank.balances.map(asset => `
                <p class="actual-asset-item">
                    ${asset.currency} ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
            `).join('')}
        </div>

        <hr class="card-divider">

        <!-- التحويلات -->
        <div class="converted-values">
            <p>SAR: ${totalSAR.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            <p>USD: ${totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>

    </div>

    <div class="actions-fixed">
    <button class="btn primary btn-small edit-bank" data-name="${bank.name}">تعديل</button>
    <button class="btn btn-danger btn-small delete-bank" data-name="${bank.name}">حذف</button>
</div>

`;



        banksGrid.appendChild(bankCard);
        
        setTimeout(() => {
            bankCard.style.opacity = '1';
            bankCard.style.transform = 'translateY(0)';
        }, 50); 
    });

    if (banksMap.size === 0 && (!goldAsset || goldAsset.value === 0)) {
        banksGrid.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 50px; grid-column: 1 / -1;">لا توجد أصول مسجلة بعد. استخدم زر ➕ لإضافة أصل.</p>';
    }
}


// ----------------------------------------------------\
// 4. ربط الأحداث (التعديل والحذف)
// ----------------------------------------------------\

banksGrid.addEventListener('click', async (e) => {
    const target = e.target;
    const bankCard = target.closest('.bank-card');
    if (!bankCard) return; 

    const bankName = bankCard.dataset.name;

    if (target.classList.contains('edit-bank')) {
        currentEditBankName = bankName; 
        const assets = await getAllData('assets');
        const bankAssets = assets.filter(a => a.name === bankName && a.type === 'bank'); 
        
        resetModal();
        bankNameInput.value = bankName;
        bankNameInput.disabled = true; // منع تغيير الاسم أثناء التعديل
        currencyRowsContainer.innerHTML = ''; 
        
        // 🆕 ملء المودال بالبيانات وتخزين الـ IDs الأصلية
        initialAssetsIDs = [];
        bankAssets.forEach(asset => {
            addRow(asset.currency, asset.value, asset.id); // تمرير asset.id هنا
            initialAssetsIDs.push(asset.id);
        });
        
        openModal(modalBackdrop);
    } else if (target.classList.contains('delete-bank')) {
        currentEditBankName = bankName;
        confirmTextEl.textContent = `هل أنت متأكد من حذف الأصل: ${bankName} نهائيًا؟`;
        openModal(confirmBackdrop);
    }
});

// تكملة ربط أحداث الحذف المؤكد (تعتمد على حذف جميع الأصول بنفس الاسم)
confirmYesBtn.addEventListener('click', async () => {
    if (currentEditBankName) {
        try {
            // استخدام دالة الحذف الجماعي لحذف البنك بالكامل
            const assets = await getAllData('assets');
            const bankAssets = assets.filter(a => a.name === currentEditBankName && a.type === 'bank'); 
            const idsToDelete = bankAssets.map(a => a.id);

            await deleteAssetsByIDs(idsToDelete); 
            showNotification(`✅ تم حذف الأصل ${currentEditBankName} بنجاح.`, false);
            closeModal(confirmBackdrop);
            displayBanks(); 
        } catch (error) {
            showNotification('❌ فشل حذف الأصل. تحقق من Console Browser.', true);
        }
        currentEditBankName = null;
    }
});


// ربط أحداث التشغيل
document.addEventListener('DOMContentLoaded', () => {
    displayBanks(); 
    openBanksModalBtn.addEventListener('click', () => {
        resetModal();
        openModal(modalBackdrop);
    });
    closeBanksModalBtn.addEventListener('click', () => closeModal(modalBackdrop));
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal(modalBackdrop);
    });
    confirmNoBtn.addEventListener('click', () => closeModal(confirmBackdrop));
    confirmBackdrop.addEventListener('click', (e) => {
        if (e.target === confirmBackdrop) closeModal(confirmBackdrop);
    });
    addRowBtn.addEventListener('click', () => addRow());
});