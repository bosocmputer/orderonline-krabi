<script setup>
import BalanceService from '@/services/BalanceService';
import { computed, onMounted, reactive, ref } from 'vue';

const loading = ref(false);
const priceLoading = ref(false);
const balanceData = ref([]);
const expandedRows = ref({});
const expandedDetails = ref({});
const expandedLoading = ref({});
const expandedPriceLoading = ref({});

const totalRecords = ref(0);
const currentPage = ref(0);
const pageSize = ref(30);

const sortOrder = ref('asc');
const sortColumn = ref('');

const filters = reactive({
    search: '',
    warehouse: [],
    shelfFrom: [],
    shelfTo: [],
    groupSub: [],
    groupSub2: [],
    brand: [],
    model: [],
    category: [],
    format: []
});

const warehouseOptions = ref([]);
const shelfOptions = ref([]);
const groupSubOptions = ref([]);
const groupSub2Options = ref([]);
const brandOptions = ref([]);
const modelOptions = ref([]);
const categoryOptions = ref([]);
const formatOptions = ref([]);

const filterLoading = reactive({
    warehouse: false,
    shelf: false,
    groupSub: false,
    groupSub2: false,
    brand: false,
    model: false,
    category: false,
    format: false
});

function qtyShow(qty) {
    const num = parseFloat(String(qty).replace(/,/g, ''));
    if (num <= 0) return '0';
    if (num <= 4) return String(Math.floor(num));
    if (num <= 12) return '4+';
    if (num <= 20) return '12+';
    if (num <= 40) return '20+';
    if (num <= 100) return '40+';
    return '100+';
}

const totalBalanceQty = computed(() => {
    return balanceData.value.reduce((sum, row) => {
        const num = parseFloat(String(row.balance_qty || '0').replace(/,/g, ''));
        return sum + (isNaN(num) ? 0 : num);
    }, 0);
});

async function loadBalanceList() {
    loading.value = true;
    priceLoading.value = false;
    expandedRows.value = {};
    expandedDetails.value = {};
    try {
        const params = {
            search: filters.search,
            warehouse: filters.warehouse.join(','),
            shelfFrom: filters.shelfFrom.length > 0 ? filters.shelfFrom[0] : '',
            shelfTo: filters.shelfTo.length > 0 ? filters.shelfTo[0] : '',
            groupSub: filters.groupSub.join(','),
            groupSub2: filters.groupSub2.join(','),
            brand: filters.brand.join(','),
            model: filters.model.join(','),
            category: filters.category.join(','),
            format: filters.format.join(','),
            sort: sortOrder.value,
            sortCol: sortColumn.value,
            offset: currentPage.value * pageSize.value,
            limit: pageSize.value
        };
        const response = await BalanceService.getBalanceListLite(params);
        if (response.data && response.data.success) {
            balanceData.value = (response.data.data || []).map((item) => ({
                ...item,
                price: '',
                balance_qty: '',
                year_weak: '',
                update_date: '',
                _priceLoaded: false
            }));
            if (response.data.pagination) {
                totalRecords.value = response.data.pagination.total || 0;
            }
            // lazy load ราคา/stock หลังได้ list แล้ว
            lazyLoadPriceBatch();
        }
    } catch (err) {
        console.error('Error loading balance list:', err);
        balanceData.value = [];
        totalRecords.value = 0;
    } finally {
        loading.value = false;
    }
}

async function lazyLoadPriceBatch() {
    const items = balanceData.value.filter((r) => !r._priceLoaded);
    if (items.length === 0) return;

    priceLoading.value = true;
    const itemCodes = items.map((r) => r.item_code).join(',');
    const custCode = localStorage.getItem('_userCode') || '';
    const warehouse = filters.warehouse.join(',');
    const shelfList = items[0]?.shelf_list || '';

    try {
        const response = await BalanceService.getBalanceItemPriceBatch(itemCodes, custCode, warehouse, shelfList);
        if (response.data && response.data.success && response.data.data) {
            const priceMap = {};
            for (const p of response.data.data) {
                priceMap[p.item_code] = p;
            }
            balanceData.value = balanceData.value.map((row) => {
                const pd = priceMap[row.item_code];
                if (pd) {
                    return {
                        ...row,
                        price: pd.price || '0',
                        balance_qty: pd.balance_qty || '0',
                        year_weak: pd.year_weak || '',
                        update_date: pd.update_date || '',
                        _priceLoaded: true
                    };
                }
                return { ...row, _priceLoaded: true };
            });
        }
    } catch (err) {
        console.error('Error loading price batch:', err);
        // mark all as loaded to stop showing spinners
        balanceData.value = balanceData.value.map((row) => ({ ...row, _priceLoaded: true }));
    } finally {
        priceLoading.value = false;
    }
}

async function loadBalanceDetail(row) {
    const key = row.item_code;
    if (expandedDetails.value[key]) return;
    expandedLoading.value[key] = true;
    try {
        const response = await BalanceService.getBalanceDetail(row.item_code, row.shelf_list || '', row.warehouse_list || '');
        if (response.data && response.data.success) {
            // เพิ่ม _priceLoaded flag + price placeholder ให้แต่ละ detail row
            expandedDetails.value[key] = (response.data.data || []).map((d) => ({
                ...d,
                price: '',
                _priceLoaded: false
            }));
            // lazy load ราคาหลัง detail render
            lazyLoadDetailPrices(key);
        }
    } catch (err) {
        console.error('Error loading balance detail:', err);
        expandedDetails.value[key] = [];
    } finally {
        expandedLoading.value[key] = false;
    }
}

async function lazyLoadDetailPrices(itemCode) {
    const details = expandedDetails.value[itemCode];
    if (!details || details.length === 0) return;

    expandedPriceLoading.value[itemCode] = true;
    const custCode = localStorage.getItem('_userCode') || '';

    try {
        // เรียก API ทีละ row (แต่ละ row มี location ต่างกัน)
        const promises = details.map((d) =>
            BalanceService.getBalanceDetailPrice(
                d.item_code,
                d.location || '',
                d.unit_code || '',
                custCode,
                '1'
            ).catch(() => null)
        );
        const results = await Promise.all(promises);

        expandedDetails.value[itemCode] = details.map((d, idx) => {
            const res = results[idx];
            if (res && res.data && res.data.success) {
                return { ...d, price: res.data.price || '0', _priceLoaded: true };
            }
            return { ...d, price: '0', _priceLoaded: true };
        });
    } catch (err) {
        console.error('Error loading detail prices:', err);
        expandedDetails.value[itemCode] = details.map((d) => ({ ...d, price: '0', _priceLoaded: true }));
    } finally {
        expandedPriceLoading.value[itemCode] = false;
    }
}

function onRowExpand(event) {
    loadBalanceDetail(event.data);
}

function onPage(event) {
    currentPage.value = event.page;
    pageSize.value = event.rows;
    loadBalanceList();
}

function onSort(event) {
    const field = event.sortField;
    const order = event.sortOrder === 1 ? 'asc' : 'desc';
    const sortMap = {
        item_code: '',
        year_weak: 'year_weak'
    };
    sortColumn.value = sortMap[field] !== undefined ? sortMap[field] : '';
    sortOrder.value = order;
    currentPage.value = 0;
    loadBalanceList();
}

function handleSearch() {
    currentPage.value = 0;
    loadBalanceList();
}

function onSearchKeyup(e) {
    if (e.key === 'Enter') {
        handleSearch();
    }
}

function clearFilters() {
    filters.search = '';
    filters.warehouse = [];
    filters.shelfFrom = [];
    filters.shelfTo = [];
    filters.groupSub = [];
    filters.groupSub2 = [];
    filters.brand = [];
    filters.model = [];
    filters.category = [];
    filters.format = [];
    currentPage.value = 0;
    loadBalanceList();
}

function getDetailRowStyle(row) {
    if (['KBG2', 'KBYT2', 'VLT2'].includes(row.warehouse)) {
        return { backgroundColor: '#00ff80' };
    }
    return {};
}

function getOverdueStyle(row) {
    if (['KBG2', 'KBYT2', 'VLT2'].includes(row.warehouse)) {
        return { backgroundColor: '#00ff80', padding: '4px 8px', borderRadius: '4px' };
    }
    return { backgroundColor: '#FFCC66', padding: '4px 8px', borderRadius: '4px' };
}

async function loadFilterOptions(serviceFn, targetRef, loadingKey) {
    if (targetRef.value.length > 0) return;
    filterLoading[loadingKey] = true;
    try {
        const res = await serviceFn();
        if (res.data && res.data.success) {
            targetRef.value = (res.data.data || []).map((item) => ({
                code: item.code,
                name: item.name_1 || item.name || item.code
            }));
        }
    } catch (err) {
        console.error('Error loading filter options:', err);
    } finally {
        filterLoading[loadingKey] = false;
    }
}

onMounted(() => {
    loadFilterOptions(BalanceService.getSearchWarehouseList, warehouseOptions, 'warehouse');
    loadFilterOptions(BalanceService.getSearchShelfList, shelfOptions, 'shelf');
    loadFilterOptions(BalanceService.getSearchGroupSubList, groupSubOptions, 'groupSub');
    loadFilterOptions(BalanceService.getSearchGroupSub2List, groupSub2Options, 'groupSub2');
    loadFilterOptions(BalanceService.getSearchBrandList, brandOptions, 'brand');
    loadFilterOptions(BalanceService.getSearchModelList, modelOptions, 'model');
    loadFilterOptions(BalanceService.getSearchCategoryList, categoryOptions, 'category');
    loadFilterOptions(BalanceService.getSearchFormatList, formatOptions, 'format');
});
</script>

<template>
    <div class="balance-list-page">
        <div class="page-header">
            <h2><i class="pi pi-list"></i> รายการสินค้า</h2>
        </div>

        <!-- ========== Filter Section ========== -->
        <div class="card filter-section">
            <h3 class="filter-title"><i class="pi pi-filter"></i> เงื่อนไขการค้นหา</h3>
            <div class="filter-grid">
                <!-- ค้นหาสินค้า -->
                <div class="filter-item filter-item-wide">
                    <label>ค้นหาสินค้า</label>
                    <div class="p-inputgroup">
                        <InputText v-model="filters.search" placeholder="รหัสสินค้า / ชื่อสินค้า" @keyup="onSearchKeyup" class="w-full" />
                    </div>
                </div>

                <!-- คลังสินค้า -->
                <div class="filter-item">
                    <label>คลังสินค้า</label>
                    <MultiSelect
                        v-model="filters.warehouse"
                        :options="warehouseOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกคลัง"
                        :filter="true"
                        filterPlaceholder="ค้นหาคลัง"
                        :loading="filterLoading.warehouse"
                        class="w-full"
                        :maxSelectedLabels="2"
                    />
                </div>

                <!-- ที่เก็บ (จาก) -->
                <div class="filter-item">
                    <label>ที่เก็บ (จาก)</label>
                    <MultiSelect
                        v-model="filters.shelfFrom"
                        :options="shelfOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกที่เก็บ"
                        :filter="true"
                        filterPlaceholder="ค้นหาที่เก็บ"
                        :loading="filterLoading.shelf"
                        class="w-full"
                        :selectionLimit="1"
                        :maxSelectedLabels="1"
                    />
                </div>

                <!-- ที่เก็บ (ถึง) -->
                <div class="filter-item">
                    <label>ที่เก็บ (ถึง)</label>
                    <MultiSelect
                        v-model="filters.shelfTo"
                        :options="shelfOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกที่เก็บ"
                        :filter="true"
                        filterPlaceholder="ค้นหาที่เก็บ"
                        :loading="filterLoading.shelf"
                        class="w-full"
                        :selectionLimit="1"
                        :maxSelectedLabels="1"
                    />
                </div>

                <!-- กลุ่มย่อย 1 -->
                <div class="filter-item">
                    <label>กลุ่มย่อย 1</label>
                    <MultiSelect
                        v-model="filters.groupSub"
                        :options="groupSubOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกกลุ่มย่อย 1"
                        :filter="true"
                        filterPlaceholder="ค้นหา"
                        :loading="filterLoading.groupSub"
                        class="w-full"
                        :maxSelectedLabels="2"
                    />
                </div>

                <!-- กลุ่มย่อย 2 -->
                <div class="filter-item">
                    <label>กลุ่มย่อย 2</label>
                    <MultiSelect
                        v-model="filters.groupSub2"
                        :options="groupSub2Options"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกกลุ่มย่อย 2"
                        :filter="true"
                        filterPlaceholder="ค้นหา"
                        :loading="filterLoading.groupSub2"
                        class="w-full"
                        :maxSelectedLabels="2"
                    />
                </div>

                <!-- ยี่ห้อ -->
                <div class="filter-item">
                    <label>ยี่ห้อ</label>
                    <MultiSelect
                        v-model="filters.brand"
                        :options="brandOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกยี่ห้อ"
                        :filter="true"
                        filterPlaceholder="ค้นหายี่ห้อ"
                        :loading="filterLoading.brand"
                        class="w-full"
                        :maxSelectedLabels="2"
                    />
                </div>

                <!-- รุ่น -->
                <div class="filter-item">
                    <label>รุ่น</label>
                    <MultiSelect
                        v-model="filters.model"
                        :options="modelOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกรุ่น"
                        :filter="true"
                        filterPlaceholder="ค้นหารุ่น"
                        :loading="filterLoading.model"
                        class="w-full"
                        :maxSelectedLabels="2"
                    />
                </div>

                <!-- หมวดหมู่ -->
                <div class="filter-item">
                    <label>หมวดหมู่</label>
                    <MultiSelect
                        v-model="filters.category"
                        :options="categoryOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกหมวดหมู่"
                        :filter="true"
                        filterPlaceholder="ค้นหาหมวดหมู่"
                        :loading="filterLoading.category"
                        class="w-full"
                        :maxSelectedLabels="2"
                    />
                </div>

                <!-- ลาย -->
                <div class="filter-item">
                    <label>ลาย</label>
                    <MultiSelect
                        v-model="filters.format"
                        :options="formatOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="เลือกลาย"
                        :filter="true"
                        filterPlaceholder="ค้นหาลาย"
                        :loading="filterLoading.format"
                        class="w-full"
                        :maxSelectedLabels="2"
                    />
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="filter-actions">
                <Button label="ค้นหา" icon="pi pi-search" severity="primary" @click="handleSearch" />
                <Button label="ล้างเงื่อนไข" icon="pi pi-times" severity="secondary" outlined @click="clearFilters" />
            </div>
        </div>

        <!-- ========== DataTable Section ========== -->
        <div class="card table-section">
            <DataTable
                :value="balanceData"
                :loading="loading"
                :lazy="true"
                :paginator="true"
                :rows="pageSize"
                :totalRecords="totalRecords"
                :rowsPerPageOptions="[10, 20, 30, 50, 100]"
                @page="onPage"
                @sort="onSort"
                removableSort
                v-model:expandedRows="expandedRows"
                @rowExpand="onRowExpand"
                dataKey="item_code"
                responsiveLayout="scroll"
                stripedRows
                class="balance-table"
                :rowHover="true"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                currentPageReportTemplate="แสดง {first} ถึง {last} จาก {totalRecords} รายการ"
            >
                <template #empty>
                    <div class="text-center py-6">
                        <i class="pi pi-inbox" style="font-size: 2.5rem; color: #ccc"></i>
                        <p style="color: #999">ไม่พบข้อมูล กรุณาค้นหาหรือปรับเงื่อนไข</p>
                    </div>
                </template>

                <template #loading>
                    <div class="text-center py-6">
                        <i class="pi pi-spin pi-spinner" style="font-size: 2.5rem"></i>
                        <p>กำลังโหลดข้อมูล...</p>
                    </div>
                </template>

                <template #header>
                    <ProgressBar v-if="priceLoading" mode="indeterminate" style="height: 4px" />
                </template>

                <Column expander style="width: 3rem" />

                <Column field="item_code" header="รหัสสินค้า ~ ชื่อสินค้า" sortable style="min-width: 280px">
                    <template #body="{ data }">
                        <span class="font-bold">{{ data.item_code }}</span>
                        <span style="color: #888"> ~ {{ data.item_name }}</span>
                    </template>
                </Column>
                <Column field="price" header="ราคา" style="min-width: 120px; text-align: right">
                    <template #body="{ data }">
                        <i v-if="!data._priceLoaded" class="pi pi-spin pi-spinner" style="font-size: 1rem"></i>
                        <span v-else>{{
                            Number(data.price || 0).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })
                        }}</span>
                    </template>
                </Column>

                <Column field="balance_qty" header="จำนวน" style="min-width: 120px; text-align: center">
                    <template #body="{ data }">
                        <i v-if="!data._priceLoaded" class="pi pi-spin pi-spinner" style="font-size: 1rem"></i>
                        <Tag v-else :severity="qtyShow(data.balance_qty) === '0' ? 'danger' : 'success'" :value="qtyShow(data.balance_qty) + ' (' + data.unit_code + ')'" />
                    </template>
                </Column>

                <Column field="year_weak" header="ที่เก็บ" sortable style="min-width: 120px">
                    <template #body="{ data }">
                        {{ data.year_weak || '-' }}
                    </template>
                </Column>

                <template #footer>
                    <div class="footer-summary">
                        <span class="font-bold">รวมจำนวน (หน้านี้):</span>
                        <Tag severity="info" :value="totalBalanceQty.toLocaleString('en-US') + ' '" />
                    </div>
                </template>

                <!-- Row Expansion -->
                <template #expansion="{ data }">
                    <div class="expansion-content">
                        <h4>
                            <i class="pi pi-warehouse"></i> รายละเอียดคลัง/ที่เก็บ -
                            {{ data.item_code }}
                        </h4>                        <ProgressBar v-if="expandedLoading[data.item_code]" mode="indeterminate" style="height: 4px" />

                        <template v-else-if="expandedDetails[data.item_code] && expandedDetails[data.item_code].length > 0">
                            <ProgressBar v-if="expandedPriceLoading[data.item_code]" mode="indeterminate" style="height: 3px; margin-bottom: 0.5rem" />
                            <DataTable :value="expandedDetails[data.item_code]" class="detail-table" responsiveLayout="scroll" :rowStyle="getDetailRowStyle">
                            <Column field="warehouse" header="คลัง" style="min-width: 100px">
                                <template #body="{ data: detail }">
                                    <span class="font-bold">{{ detail.warehouse }}</span>
                                </template>
                            </Column>
                            <Column field="location" header="ที่เก็บ" style="min-width: 100px" />
                            <Column field="balance_qty" header="จำนวน" style="min-width: 120px">
                                <template #body="{ data: detail }"> {{ detail.balance_qty }} ({{ detail.unit_code }}) </template>
                            </Column>
                            <Column field="price" header="ราคา" style="min-width: 120px; text-align: right">
                                <template #body="{ data: detail }">
                                    <i v-if="!detail._priceLoaded" class="pi pi-spin pi-spinner" style="font-size: 0.9rem"></i>
                                    <span v-else>{{
                                        Number(detail.price || 0).toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })
                                    }}</span>
                                </template>
                            </Column>
                            <Column field="overdue" header="ค้างส่ง" style="min-width: 100px">
                                <template #body="{ data: detail }">
                                    <span :style="getOverdueStyle(detail)">
                                        {{ parseFloat(detail.overdue || 0).toFixed(0) }}
                                    </span>
                                </template>
                            </Column>
                            <Column header="ขายได้" style="min-width: 100px">
                                <template #body="{ data: detail }">
                                    {{ (parseFloat(detail.balance_qty) - parseFloat(detail.overdue || 0)).toFixed(0) }}
                                </template>
                            </Column>
                        </DataTable>
                        </template>

                        <div v-else class="text-center" style="padding: 1rem; color: #999"><i class="pi pi-info-circle"></i> ไม่พบข้อมูลรายละเอียด</div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
.balance-list-page {
    padding: 1rem;
}
.page-header {
    margin-bottom: 1rem;
}
.page-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-color, #333);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.card {
    background: var(--surface-card, #fff);
    border-radius: 10px;
    padding: 1.25rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.filter-section .filter-title {
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--primary-color, #3b82f6);
}
.filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.75rem 1rem;
    margin-bottom: 1rem;
}
.filter-item label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
    color: var(--text-color-secondary, #6c757d);
}
.filter-item-wide {
    grid-column: span 2;
}
.filter-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--surface-border, #e5e7eb);
}
.expansion-content {
    padding: 1rem;
    background: #eef6ff;
    border-radius: 8px;
}
.expansion-content h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    color: var(--primary-color, #3b82f6);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
:deep(.detail-table) {
    font-size: 0.9rem;
}
:deep(.detail-table .p-datatable-thead > tr > th) {
    background: #fdebd0 !important;
    font-weight: 600;
}
.footer-summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
}
@media screen and (max-width: 768px) {
    .filter-grid {
        grid-template-columns: 1fr;
    }
    .filter-item-wide {
        grid-column: span 1;
    }
    .filter-actions {
        flex-direction: column;
    }
}
</style>
