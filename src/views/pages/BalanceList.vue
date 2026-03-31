<script setup>
import BalanceService from "@/services/BalanceService";
import ProductService from "@/services/ProductService";
import { useAuthenStore } from "@/stores/authen";
import { openQuotationPdf } from "@/utils/quotationPdf";
import Checkbox from "primevue/checkbox";
import Drawer from "primevue/drawer";
import Galleria from "primevue/galleria";
import { useToast } from "primevue/usetoast";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";

const loading = ref(false);
const stockLoading = ref(false);
const balanceData = ref([]);
const expandedRows = ref({});
const expandedDetails = ref({});
const expandedLoading = ref({});
const expandedPriceLoading = ref({});
const expandedImages = ref({});
const expandedImagesLoading = ref({});

const locationQuantities = ref({});

// ===== QUOTATION CART =====
const QUOTATION_CART_KEY = "_quotationCart";
function loadQuotationCart() {
  try {
    const r = localStorage.getItem(QUOTATION_CART_KEY);
    return r ? JSON.parse(r) : [];
  } catch {
    return [];
  }
}
function saveQuotationCart(items) {
  localStorage.setItem(QUOTATION_CART_KEY, JSON.stringify(items));
}
const quotationCart = ref(loadQuotationCart());
const quotationPanelVisible = ref(false);
const quotationTotal = computed(() =>
  quotationCart.value.reduce(
    (s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 0),
    0
  )
);
const quotationTotalItems = computed(() => quotationCart.value.length);

const authenStore = useAuthenStore();
const toast = useToast();

function addToQuotationCart(headerRow, detail) {
  const qty = getQty(headerRow.item_code, detail.warehouse, detail.location);
  if (!qty || qty <= 0) {
    toast.add({
      severity: "warn",
      summary: "แจ้งเตือน",
      detail: "กรุณาระบุจำนวน",
      life: 2000,
    });
    return;
  }
  const price = detail._priceLoaded
    ? parseFloat(detail.price || 0)
    : parseFloat(headerRow.price_0 || 0);
  const existIdx = quotationCart.value.findIndex(
    (i) =>
      i.item_code === headerRow.item_code &&
      i.wh_code === detail.warehouse &&
      i.shelf_code === detail.location
  );
  if (existIdx >= 0) {
    quotationCart.value[existIdx].qty = (
      parseInt(quotationCart.value[existIdx].qty) + qty
    ).toString();
  } else {
    quotationCart.value.push({
      item_code: headerRow.item_code,
      item_name: headerRow.item_name,
      unit_code: detail.unit_code || headerRow.unit_code || "",
      qty: qty.toString(),
      price,
      wh_code: detail.warehouse,
      shelf_code: detail.location,
    });
  }
  saveQuotationCart(quotationCart.value);
  locationQuantities.value[
    getQtyKey(headerRow.item_code, detail.warehouse, detail.location)
  ] = 0;
  toast.add({
    severity: "success",
    summary: "เพิ่มแล้ว",
    detail: `${headerRow.item_name} ใส่ใบเสนอราคาแล้ว`,
    life: 2000,
  });
}

function removeFromQuotationCart(index) {
  quotationCart.value.splice(index, 1);
  saveQuotationCart(quotationCart.value);
}

function updateQuotationQty(index, newQty) {
  const n = parseInt(newQty);
  if (isNaN(n) || n <= 0) {
    removeFromQuotationCart(index);
    return;
  }
  quotationCart.value[index].qty = n.toString();
  saveQuotationCart(quotationCart.value);
}

function clearQuotationCart() {
  quotationCart.value = [];
  localStorage.removeItem(QUOTATION_CART_KEY);
}

function printQuotation() {
  quotationPanelVisible.value = false;
  const whName = (() => {
    try {
      const d = localStorage.getItem("_selectedWarehouse");
      if (d) {
        const p = JSON.parse(d);
        return p.name || p.code || "";
      }
    } catch {
      /* ignore */
    }
    return "";
  })();
  openQuotationPdf({
    cart: quotationCart.value,
    customerCode: authenStore.userData?.user_code || "",
    customerName: authenStore.userData?.user_name || "",
    warehouseName: whName,
    createdBy: authenStore.empData?.user_code || "",
  });
}

function getSelectedWarehouse() {
  try {
    const data = localStorage.getItem("_selectedWarehouse");
    if (data) return JSON.parse(data).code || "";
  } catch (e) {
    /* ignore */
  }
  return "";
}
const selectedWarehouse = ref(getSelectedWarehouse());

function isDetailOrderable(detail) {
  return detail.warehouse === selectedWarehouse.value;
}

const hasNextPage = ref(false);
const currentPage = ref(0);
const pageSize = ref(30);

const sortOrder = ref("asc");
const sortColumn = ref("");

// Dynamic search fields - กดเพิ่ม/ลดช่องค้นหาได้
let searchFieldIdCounter = 1;
const searchFields = ref([{ id: searchFieldIdCounter++, value: "" }]);

function addSearchField() {
  searchFields.value.push({ id: searchFieldIdCounter++, value: "" });
}

function removeSearchField(id) {
  if (searchFields.value.length <= 1) return;
  searchFields.value = searchFields.value.filter((f) => f.id !== id);
}

function getSearchQuery() {
  return searchFields.value
    .map((f) => f.value.trim())
    .filter((v) => v !== "")
    .join("|");
}

const stockFilterOptions = [
  { label: "ทั้งหมด", value: "all" },
  { label: "มีคงเหลือ", value: "gt0" },
  { label: "หมด", value: "zero" },
  { label: "ใกล้หมด", value: "low" },
];

const filters = reactive({
  search: "",
  stockFilter: localStorage.getItem("_isstock") === "1" ? "gt0" : "all",
  warehouseGroup: [],
  warehouse: [],
  shelfFrom: "",
  shelfTo: "",
  groupSub: [],
  groupSub2: [],
  brand: [],
  model: [],
  category: [],
  format: [],
  qtyConditions: [{ op: ">=", val: "" }],
  dotYears: [],
  priceFrom: "",
  priceTo: "",
});

const currentYear = new Date().getFullYear();
const dotYearOptions = Array.from({ length: 5 }, (_, i) => ({
  label: `${currentYear - i}`,
  value: String(currentYear - i),
}));

const warehouseOptions = ref([]);
const shelfOptions = ref([]);

// กลุ่มคลัง — คำนวณจาก warehouseOptions โดยใช้ตัวเลขท้าย code
const warehouseGroupOptions = computed(() => {
  const groupMap = {};
  for (const wh of warehouseOptions.value) {
    const match = wh.code.match(/(\d+)$/);
    if (!match) continue;
    const num = match[1];
    if (!groupMap[num]) groupMap[num] = [];
    groupMap[num].push(wh.code);
  }
  return Object.keys(groupMap)
    .sort()
    .map((num) => ({ label: `กลุ่ม ${num}`, value: groupMap[num].join(",") }));
});
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
  format: false,
});

function parsePrice(val) {
  if (val === null || val === undefined || val === "") return "-";
  const num = parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return "-";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function qtyShow(qty) {
  const num = parseFloat(String(qty).replace(/,/g, ""));
  if (isNaN(num)) return "0";
  return String(Math.floor(num));
}

const totalBalanceQty = computed(() => {
  return balanceData.value.reduce((sum, row) => {
    const num = parseFloat(String(row.balance_qty || "0").replace(/,/g, ""));
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
});

async function loadBalanceList() {
  loading.value = true;
  expandedRows.value = {};
  expandedDetails.value = {};
  try {
    const params = {
      search: filters.search,
      warehouse: (() => {
        const fromGroups = (filters.warehouseGroup || []).flatMap((g) => g.split(","));
        const fromSelect = filters.warehouse || [];
        const merged = [...new Set([...fromGroups, ...fromSelect])];
        return merged.join(",");
      })(),
      shelfFrom: filters.shelfFrom || "",
      shelfTo: filters.shelfTo || "",
      groupSub: filters.groupSub.join(","),
      groupSub2: filters.groupSub2.join(","),
      brand: filters.brand.join(","),
      model: filters.model.join(","),
      category: filters.category.join(","),
      format: filters.format.join(","),
      sort: sortOrder.value,
      sortCol: sortColumn.value,
      offset: currentPage.value * pageSize.value,
      limit: pageSize.value,
      stockfilter: filters.stockFilter || "all",
      qty_conditions: filters.qtyConditions
        .filter((c) => c.val !== "")
        .map((c) => c.op + c.val)
        .join("|"),
      dot_years: filters.dotYears.join(","),
      price_from: filters.priceFrom || "",
      price_to: filters.priceTo || "",
    };
    const response = await BalanceService.getBalanceListLite(params);
    if (response.data && response.data.success) {
      balanceData.value = (response.data.data || []).map((item) => ({
        ...item,
        _stockLoaded: true,
      }));
      if (response.data.pagination) {
        hasNextPage.value = response.data.pagination.hasNext || false;
      }
    }
  } catch (err) {
    console.error("Error loading balance list:", err);
    balanceData.value = [];
    hasNextPage.value = false;
  } finally {
    loading.value = false;
  }
}


async function loadBalanceDetail(row) {
  const key = row.item_code;
  if (expandedDetails.value[key]) return;
  expandedLoading.value[key] = true;
  try {
    const response = await BalanceService.getBalanceDetail(
      row.item_code,
      row.shelf_list || "",
      row.warehouse_list || ""
    );
    if (response.data && response.data.success) {
      let detailRows = response.data.data || [];
      // กรอง detail ตาม dotYears ที่เลือก (location 4 หลัก เช่น 2604 → ปี 26)
      if (filters.dotYears.length > 0) {
        const selectedPfx = filters.dotYears.map((y) => String(y).slice(-2));
        detailRows = detailRows.filter((d) => {
          const loc = d.location || '';
          return selectedPfx.includes(loc.substring(0, 2));
        });
      }
      // เพิ่ม _priceLoaded flag + price placeholder ให้แต่ละ detail row
      expandedDetails.value[key] = detailRows.map((d) => ({
        ...d,
        price: "",
        _priceLoaded: false,
      }));
      // lazy load ราคาหลัง detail render
      lazyLoadDetailPrices(key);
    }
  } catch (err) {
    console.error("Error loading balance detail:", err);
    expandedDetails.value[key] = [];
  } finally {
    expandedLoading.value[key] = false;
  }
}

async function lazyLoadDetailPrices(itemCode) {
  const details = expandedDetails.value[itemCode];
  if (!details || details.length === 0) return;

  expandedPriceLoading.value[itemCode] = true;
  const custCode = localStorage.getItem("_userCode") || "";

  try {
    // เรียก API ทีละ row (แต่ละ row มี location ต่างกัน)
    const promises = details.map((d) =>
      BalanceService.getBalanceDetailPrice(
        d.item_code,
        d.location || "",
        d.unit_code || "",
        custCode,
        "1"
      ).catch(() => null)
    );
    const results = await Promise.all(promises);

    expandedDetails.value[itemCode] = details.map((d, idx) => {
      const res = results[idx];
      if (res && res.data && res.data.success) {
        return { ...d, price: res.data.price || "0", _priceLoaded: true };
      }
      return { ...d, price: "0", _priceLoaded: true };
    });
  } catch (err) {
    console.error("Error loading detail prices:", err);
    expandedDetails.value[itemCode] = details.map((d) => ({
      ...d,
      price: "0",
      _priceLoaded: true,
    }));
  } finally {
    expandedPriceLoading.value[itemCode] = false;
  }
}

async function loadImages(itemCode) {
  if (expandedImages.value[itemCode] !== undefined) return;
  expandedImagesLoading.value[itemCode] = true;
  try {
    const imageList = await ProductService.getImageList(itemCode);
    if (imageList && imageList.length > 0) {
      expandedImages.value[itemCode] = imageList.map((img) => ({
        itemImageSrc: ProductService.getProductImageByGuid(img.guid_code),
        thumbnailImageSrc: ProductService.getProductImageByGuid(img.guid_code),
        alt: itemCode,
      }));
    } else {
      expandedImages.value[itemCode] = [
        {
          itemImageSrc: ProductService.getPlaceholderImage(),
          thumbnailImageSrc: ProductService.getPlaceholderImage(),
          alt: itemCode,
        },
      ];
    }
  } catch {
    expandedImages.value[itemCode] = [
      {
        itemImageSrc: ProductService.getPlaceholderImage(),
        thumbnailImageSrc: ProductService.getPlaceholderImage(),
        alt: itemCode,
      },
    ];
  } finally {
    expandedImagesLoading.value[itemCode] = false;
  }
}

function onRowExpand(event) {
  loadBalanceDetail(event.data);
  loadImages(event.data.item_code);
}

function getQtyKey(itemCode, warehouse, location) {
  return `${itemCode}_${warehouse}_${location}`;
}

function getQty(itemCode, warehouse, location) {
  return locationQuantities.value[getQtyKey(itemCode, warehouse, location)] || 0;
}

function onPage(event) {
  currentPage.value = event.page;
  pageSize.value = event.rows;
  loadBalanceList();
}

function onSort(event) {
  const field = event.sortField;
  const order = event.sortOrder === 1 ? "asc" : "desc";
  const sortMap = {
    item_code: "",
    price_0: "price_0",
    price_9: "price_9",
    description: "description",
  };
  sortColumn.value = sortMap[field] !== undefined ? sortMap[field] : "";
  sortOrder.value = order;
  currentPage.value = 0;
  loadBalanceList();
}

function handleSearch() {
  filters.search = getSearchQuery();
  currentPage.value = 0;
  loadBalanceList();
}

function onSearchKeyup(e) {
  if (e.key === "Enter") {
    handleSearch();
  }
}

function clearFilters() {
  searchFields.value = [{ id: searchFieldIdCounter++, value: "" }];
  filters.search = "";
  filters.stockFilter = "all";
  filters.warehouseGroup = null;
  filters.warehouse = [];
  filters.shelfFrom = "";
  filters.shelfTo = "";
  filters.groupSub = [];
  filters.groupSub2 = [];
  filters.brand = [];
  filters.model = [];
  filters.category = [];
  filters.format = [];
  filters.qtyConditions = [{ op: ">=", val: "" }];
  filters.dotYears = [];
  filters.priceFrom = "";
  filters.priceTo = "";
  currentPage.value = 0;
  loadBalanceList();
}

function getDetailRowStyle(row) {
  if (["KBG2", "KBYT2", "VLT2"].includes(row.warehouse)) {
    return { backgroundColor: "#00ff80" };
  }
  return {};
}

function getOverdueStyle(row) {
  if (["KBG2", "KBYT2", "VLT2"].includes(row.warehouse)) {
    return { backgroundColor: "#00ff80", padding: "4px 8px", borderRadius: "4px" };
  }
  return { backgroundColor: "#FFCC66", padding: "4px 8px", borderRadius: "4px" };
}

async function loadFilterOptions(serviceFn, targetRef, loadingKey) {
  if (targetRef.value.length > 0) return;
  filterLoading[loadingKey] = true;
  try {
    const res = await serviceFn();
    if (res.data && res.data.success) {
      targetRef.value = (res.data.data || []).map((item) => ({
        code: item.code,
        name: item.name_1 || item.name || item.code,
      }));
    }
  } catch (err) {
    console.error("Error loading filter options:", err);
  } finally {
    filterLoading[loadingKey] = false;
  }
}

const route = useRoute();
watch(
  () => route.query.timestamp,
  () => {
    loadBalanceList();
  }
);

onMounted(() => {
  loadFilterOptions(BalanceService.getSearchWarehouseList, warehouseOptions, "warehouse");
  loadFilterOptions(BalanceService.getSearchShelfList, shelfOptions, "shelf");
  loadFilterOptions(BalanceService.getSearchGroupSubList, groupSubOptions, "groupSub");
  loadFilterOptions(BalanceService.getSearchGroupSub2List, groupSub2Options, "groupSub2");
  loadFilterOptions(BalanceService.getSearchBrandList, brandOptions, "brand");
  loadFilterOptions(BalanceService.getSearchModelList, modelOptions, "model");
  loadFilterOptions(BalanceService.getSearchCategoryList, categoryOptions, "category");
  loadFilterOptions(BalanceService.getSearchFormatList, formatOptions, "format");
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
        <!-- ค้นหาสินค้า (dynamic fields) -->
        <div class="filter-item filter-item-wide search-block">
          <div class="search-block-header">
            <label
              ><i class="pi pi-search" style="font-size: 0.8rem"></i> ค้นหาสินค้า</label
            >
            <span class="search-or-hint" v-if="searchFields.length > 1"
              >แต่ละช่องค้นหาแบบ OR</span
            >
          </div>
          <div
            v-for="(field, index) in searchFields"
            :key="field.id"
            class="search-field-row"
          >
            <span class="search-field-badge">{{ index + 1 }}</span>
            <InputText
              v-model="field.value"
              :placeholder="
                index === 0 ? 'รหัสสินค้า / ชื่อสินค้า' : 'เงื่อนไขเพิ่มเติม...'
              "
              @keyup="onSearchKeyup"
              class="search-input"
            />
            <Button
              v-if="searchFields.length > 1"
              icon="pi pi-times"
              severity="danger"
              text
              rounded
              @click="removeSearchField(field.id)"
              v-tooltip.top="'ลบช่องนี้'"
              class="search-btn-remove"
            />
            <Button
              v-if="index === searchFields.length - 1"
              icon="pi pi-plus"
              severity="success"
              text
              rounded
              @click="addSearchField"
              v-tooltip.top="'เพิ่มเงื่อนไข'"
              class="search-btn-add"
            />
          </div>
        </div>

        <!-- สถานะสต๊อก -->
        <div class="filter-item filter-item-wide">
          <label>สถานะสต๊อก</label>
          <SelectButton
            v-model="filters.stockFilter"
            :options="stockFilterOptions"
            optionLabel="label"
            optionValue="value"
            class="stock-filter-btn"
          />
        </div>

        <!-- กลุ่มคลัง -->
        <div class="filter-item filter-item-wide">
          <label>กลุ่มคลัง</label>
          <SelectButton
            v-model="filters.warehouseGroup"
            :options="warehouseGroupOptions"
            optionLabel="label"
            optionValue="value"
            multiple
            class="stock-filter-btn"
          />
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
          <InputText v-model="filters.shelfFrom" placeholder="เช่น A01" class="w-full" />
        </div>

        <!-- ที่เก็บ (ถึง) -->
        <div class="filter-item">
          <label>ที่เก็บ (ถึง)</label>
          <InputText v-model="filters.shelfTo" placeholder="เช่น Z99" class="w-full" />
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

        <!-- จำนวนยางคงเหลือ (multi-condition) -->
        <div class="filter-item filter-item-wide">
          <label>จำนวนยางคงเหลือ</label>
          <div
            v-for="(cond, idx) in filters.qtyConditions"
            :key="idx"
            class="multi-cond-row"
          >
            <Select
              v-model="cond.op"
              :options="[
                { label: '>=', value: '>=' },
                { label: '>', value: '>' },
                { label: '<=', value: '<=' },
                { label: '<', value: '<' },
                { label: '=', value: '=' },
              ]"
              optionLabel="label"
              optionValue="value"
              style="width: 80px"
            />
            <InputText
              v-model="cond.val"
              placeholder="จำนวน"
              style="width: 100px"
              type="number"
            />
            <Button
              icon="pi pi-times"
              text
              rounded
              severity="danger"
              size="small"
              v-if="filters.qtyConditions.length > 1"
              @click="filters.qtyConditions.splice(idx, 1)"
            />
            <Button
              icon="pi pi-plus"
              text
              rounded
              severity="success"
              size="small"
              v-if="idx === filters.qtyConditions.length - 1"
              @click="filters.qtyConditions.push({ op: '>=', val: '' })"
            />
          </div>
        </div>

        <!-- ปี DOT ยาง -->
        <div class="filter-item">
          <label>ปี DOT ยาง</label>
          <div class="dot-year-list">
            <div v-for="opt in dotYearOptions" :key="opt.value" class="dot-year-item">
              <Checkbox
                v-model="filters.dotYears"
                :value="opt.value"
                :inputId="'dot_' + opt.value"
              />
              <label :for="'dot_' + opt.value">{{ opt.label }}</label>
            </div>
          </div>
        </div>

        <!-- ราคา (range) -->
        <div class="filter-item">
          <label>ราคา (จาก - ถึง)</label>
          <div class="price-range-row">
            <InputText
              v-model="filters.priceFrom"
              placeholder="จากราคา"
              type="number"
              style="width: 110px"
            />
            <span>-</span>
            <InputText
              v-model="filters.priceTo"
              placeholder="ถึงราคา"
              type="number"
              style="width: 110px"
            />
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="filter-actions">
        <Button
          label="ค้นหา"
          icon="pi pi-search"
          severity="primary"
          @click="handleSearch"
        />
        <Button
          label="ล้างเงื่อนไข"
          icon="pi pi-times"
          severity="secondary"
          outlined
          @click="clearFilters"
        />
        <Button
          label="ใบเสนอราคา"
          icon="pi pi-file-edit"
          severity="warning"
          :badge="quotationTotalItems > 0 ? String(quotationTotalItems) : undefined"
          badgeSeverity="danger"
          @click="quotationPanelVisible = true"
        />
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
        :totalRecords="hasNextPage ? (currentPage + 2) * pageSize : (currentPage + 1) * pageSize"
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
        paginatorTemplate="PrevPageLink CurrentPageReport NextPageLink RowsPerPageDropdown"
        currentPageReportTemplate="หน้า {currentPage}"
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
          <ProgressBar v-if="stockLoading" mode="indeterminate" style="height: 4px" />
        </template>

        <Column expander style="width: 3rem" />

        <Column
          field="item_code"
          header="รหัสสินค้า ~ ชื่อสินค้า"
          sortable
          style="min-width: 280px"
        >
          <template #body="{ data }">
            <div class="font-bold">{{ data.item_name }}</div>
            <div style="color: #555; font-size: 0.88rem">{{ data.item_code }}</div>
          </template>
        </Column>        <Column
          field="price_0"
          header="ราคาขาย 0%"
          sortable
          style="min-width: 120px; text-align: right"
          headerClass="header-align-right"
        >
          <template #body="{ data }">
            <span>{{ parsePrice(data.price_0) }}</span>
          </template>
        </Column>        <Column
          field="price_9"
          header="ราคาขายสด"
          sortable
          style="min-width: 120px; text-align: right"
          headerClass="header-align-right"
        >
          <template #body="{ data }">
            <span>{{ parsePrice(data.price_9) }}</span>
          </template>
        </Column>

        <Column
          field="balance_qty_current_year"
          header="สต๊อกปีนี้"
          style="min-width: 110px; text-align: center"
        >
          <template #body="{ data }">
            <Tag
              :severity="
                parseFloat(data.balance_qty_current_year) <= 0 ? 'danger' : 'success'
              "
              :value="
                qtyShow(data.balance_qty_current_year) + ' (' + data.unit_code + ')'
              "
            />
          </template>
        </Column>

        <Column
          field="balance_qty_other_year"
          header="สต๊อกปีอื่น"
          style="min-width: 110px; text-align: center"
        >
          <template #body="{ data }">
            <Tag
              severity="warning"
              :value="qtyShow(data.balance_qty_other_year) + ' (' + data.unit_code + ')'"
            />
          </template>
        </Column>

        <Column field="description" header="โปรโมชั่น" sortable style="min-width: 180px">
          <template #body="{ data }">
            <span
              v-if="!data.description || data.description.trim() === ''"
              style="color: #ccc"
              >-</span
            >
            <div v-else class="promo-text" v-html="data.description"></div>
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
            <div class="expansion-header">
              <h4>
                <i class="pi pi-warehouse"></i> รายละเอียดคลัง/ที่เก็บ -
                {{ data.item_code }}
              </h4>
            </div>
            <div
              v-if="data.description && data.description.trim() !== ''"
              class="expansion-promo"
              v-html="data.description"
            ></div>
            <ProgressBar
              v-if="expandedLoading[data.item_code]"
              mode="indeterminate"
              style="height: 4px"
            />

            <template
              v-else-if="
                expandedDetails[data.item_code] &&
                expandedDetails[data.item_code].length > 0
              "
            >
              <ProgressBar
                v-if="expandedPriceLoading[data.item_code]"
                mode="indeterminate"
                style="height: 3px; margin-bottom: 0.5rem"
              />
              <DataTable
                :value="expandedDetails[data.item_code]"
                class="detail-table"
                responsiveLayout="scroll"
                :rowStyle="getDetailRowStyle"
                :rowClass="(row) => (!isDetailOrderable(row) ? 'row-not-orderable' : '')"
              >
                <Column field="warehouse" header="คลัง" style="min-width: 100px">
                  <template #body="{ data: detail }">
                    <span class="font-bold">{{ detail.warehouse }}</span>
                  </template>
                </Column>
                <Column field="location" header="ที่เก็บ" style="min-width: 100px" />
                <Column field="balance_qty" header="จำนวน" style="min-width: 120px">
                  <template #body="{ data: detail }">
                    {{ detail.balance_qty }} ({{ detail.unit_code }})
                  </template>
                </Column>
                <Column
                  field="price"
                  header="ราคา"
                  style="min-width: 120px; text-align: right"
                >
                  <template #body="{ data: detail }">
                    <i
                      v-if="!detail._priceLoaded"
                      class="pi pi-spin pi-spinner"
                      style="font-size: 0.9rem"
                    ></i>
                    <span v-else>{{
                      Number(detail.price || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
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
                    {{
                      (
                        parseFloat(detail.balance_qty) - parseFloat(detail.overdue || 0)
                      ).toFixed(0)
                    }}
                  </template>
                </Column>
                <Column header="ใบเสนอราคา" style="min-width: 200px">
                  <template #body="{ data: detail }">
                    <div class="quotation-action-cell">
                      <div class="qty-input-row">
                        <Button
                          icon="pi pi-minus"
                          text
                          rounded
                          size="small"
                          class="qty-btn"
                          :disabled="
                            getQty(data.item_code, detail.warehouse, detail.location) <= 0
                          "
                          @click="
                            locationQuantities[
                              getQtyKey(data.item_code, detail.warehouse, detail.location)
                            ] = Math.max(
                              0,
                              (locationQuantities[
                                getQtyKey(
                                  data.item_code,
                                  detail.warehouse,
                                  detail.location
                                )
                              ] || 0) - 1
                            )
                          "
                        />
                        <input
                          type="text"
                          class="qty-input"
                          :value="
                            getQty(data.item_code, detail.warehouse, detail.location)
                          "
                          @change="
                            (e) =>
                              (locationQuantities[
                                getQtyKey(
                                  data.item_code,
                                  detail.warehouse,
                                  detail.location
                                )
                              ] = Math.max(0, parseInt(e.target.value) || 0))
                          "
                        />
                        <Button
                          icon="pi pi-plus"
                          text
                          rounded
                          size="small"
                          class="qty-btn"
                          @click="
                            locationQuantities[
                              getQtyKey(data.item_code, detail.warehouse, detail.location)
                            ] =
                              (locationQuantities[
                                getQtyKey(
                                  data.item_code,
                                  detail.warehouse,
                                  detail.location
                                )
                              ] || 0) + 1
                          "
                        />
                      </div>
                      <Button
                        label="ใส่ตะกร้า"
                        icon="pi pi-file-edit"
                        severity="warning"
                        size="small"
                        :disabled="
                          getQty(data.item_code, detail.warehouse, detail.location) <= 0
                        "
                        @click="addToQuotationCart(data, detail)"
                      />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </template>

            <div v-else class="text-center" style="padding: 1rem; color: #999">
              <i class="pi pi-info-circle"></i> ไม่พบข้อมูลรายละเอียด
            </div>

            <!-- รูปสินค้า -->
            <div class="expansion-images">
              <div
                v-if="expandedImagesLoading[data.item_code]"
                class="text-center"
                style="padding: 1rem"
              >
                <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem"></i>
              </div>
              <Galleria
                v-else-if="
                  expandedImages[data.item_code] &&
                  expandedImages[data.item_code].length > 0
                "
                :value="expandedImages[data.item_code]"
                :numVisible="5"
                :circular="true"
                :showThumbnails="expandedImages[data.item_code].length > 1"
                :showItemNavigators="expandedImages[data.item_code].length > 1"
                containerClass="w-full galleria-expansion"
              >
                <template #item="slotProps">
                  <div
                    class="flex justify-center items-center"
                    style="height: 220px; background: #f8f9fa; border-radius: 6px"
                  >
                    <img
                      :src="slotProps.item.itemImageSrc"
                      :alt="slotProps.item.alt"
                      @error="$event.target.src = ProductService.getPlaceholderImage()"
                      style="
                        max-height: 200px;
                        max-width: 100%;
                        object-fit: contain;
                        border-radius: 6px;
                      "
                    />
                  </div>
                </template>
                <template #thumbnail="slotProps">
                  <img
                    :src="slotProps.item.thumbnailImageSrc"
                    :alt="slotProps.item.alt"
                    @error="$event.target.src = ProductService.getPlaceholderImage()"
                    style="
                      width: 50px;
                      height: 50px;
                      object-fit: contain;
                      border-radius: 4px;
                    "
                  />
                </template>
              </Galleria>
            </div>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Drawer -->
    <Drawer
      :visible="quotationPanelVisible"
      @update:visible="quotationPanelVisible = $event"
      position="right"
      :style="{ width: '420px' }"
    >
      <template #header>
        <div style="display: flex; align-items: center; gap: 0.6rem">
          <i
            class="pi pi-file-edit"
            style="font-size: 1.2rem; color: var(--orange-500)"
          ></i>
          <span style="font-weight: 700">ตะกร้าใบเสนอราคา</span>
          <Tag
            v-if="quotationTotalItems > 0"
            :value="quotationTotalItems + ' รายการ'"
            severity="warning"
          />
        </div>
      </template>

      <div v-if="quotationCart.length === 0" class="quotation-empty">
        <i class="pi pi-inbox" style="font-size: 2.5rem; color: #ccc"></i>
        <p>ยังไม่มีสินค้า</p>
      </div>
      <div v-else class="quotation-item-list">
        <div v-for="(item, idx) in quotationCart" :key="idx" class="quotation-item-card">
          <div class="quotation-item-header">
            <span class="quotation-item-code">{{ item.item_code }}</span>
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              size="small"
              @click="removeFromQuotationCart(idx)"
            />
          </div>
          <div class="quotation-item-name">{{ item.item_name }}</div>
          <div class="quotation-item-meta">
            คลัง: <b>{{ item.wh_code }}</b> | ที่เก็บ: <b>{{ item.shelf_code || "-" }}</b>
          </div>
          <div class="quotation-item-controls">
            <div class="qty-input-row">
              <Button
                icon="pi pi-minus"
                text
                rounded
                class="qty-btn"
                @click="updateQuotationQty(idx, parseInt(item.qty) - 1)"
              />
              <input
                type="text"
                class="qty-input"
                :value="item.qty"
                @change="(e) => updateQuotationQty(idx, e.target.value)"
                style="width: 3rem"
              />
              <Button
                icon="pi pi-plus"
                text
                rounded
                class="qty-btn"
                @click="updateQuotationQty(idx, parseInt(item.qty) + 1)"
              />
              <span style="font-size: 0.8rem; color: #888">{{ item.unit_code }}</span>
            </div>
            <div class="quotation-item-price">
              {{ parsePrice(item.price) }} × {{ item.qty }} =
              <b>{{ parsePrice(parseFloat(item.price) * parseInt(item.qty)) }}</b>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="quotation-footer">
          <div class="quotation-footer-total">
            <span>ยอดรวม:</span>
            <span class="quotation-total-amount"
              >{{
                quotationTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })
              }}
              บาท</span
            >
          </div>
          <div class="quotation-footer-actions">
            <Button
              label="ล้างตะกร้า"
              icon="pi pi-trash"
              severity="secondary"
              outlined
              @click="clearQuotationCart"
              :disabled="quotationCart.length === 0"
            />
            <Button
              label="พิมพ์ใบเสนอราคา"
              icon="pi pi-print"
              severity="success"
              @click="printQuotation"
              :disabled="quotationCart.length === 0"
            />
          </div>
        </div>
      </template>
    </Drawer>

    <!-- Print Area -->
    <div class="print-only">
      <div class="print-header">
        <h2>บริษัท กระบี่โยธาการค้า จำกัด</h2>
        <p>ใบเสนอราคา / Quotation</p>
        <p>
          วันที่:
          {{
            new Date().toLocaleDateString("th-TH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          }}
        </p>
      </div>
      <table class="print-customer-table">
        <tbody>
          <tr>
            <td>ลูกค้า:</td>
            <td>
              <b>{{ authenStore.fullName || authenStore.userCode || "-" }}</b>
            </td>
          </tr>
          <tr>
            <td>รหัส:</td>
            <td>{{ authenStore.userCode || "-" }}</td>
          </tr>
          <tr v-if="authenStore.userTelephone">
            <td>โทร:</td>
            <td>{{ authenStore.userTelephone }}</td>
          </tr>
          <tr v-if="authenStore.userAddress">
            <td>ที่อยู่:</td>
            <td>{{ authenStore.userAddress }}</td>
          </tr>
        </tbody>
      </table>
      <table class="print-items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>รหัสสินค้า</th>
            <th>ชื่อสินค้า</th>
            <th>คลัง</th>
            <th>ที่เก็บ</th>
            <th>จำนวน</th>
            <th>หน่วย</th>
            <th>ราคา/หน่วย</th>
            <th>รวม</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in quotationCart" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>{{ item.item_code }}</td>
            <td>{{ item.item_name }}</td>
            <td>{{ item.wh_code }}</td>
            <td>{{ item.shelf_code || "-" }}</td>
            <td style="text-align: right">{{ item.qty }}</td>
            <td>{{ item.unit_code }}</td>
            <td style="text-align: right">{{ parsePrice(item.price) }}</td>
            <td style="text-align: right">
              {{ parsePrice(parseFloat(item.price) * parseInt(item.qty)) }}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="8" style="text-align: right; font-weight: bold">
              ยอดรวมทั้งหมด:
            </td>
            <td style="text-align: right; font-weight: bold">
              {{
                quotationTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })
              }}
              บาท
            </td>
          </tr>
        </tfoot>
      </table>
      <div class="print-footer">
        <p>ลงชื่อผู้เสนอราคา .................................</p>
        <p style="color: #999; font-size: 0.85rem">
          วันที่ .................................
        </p>
      </div>
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

/* ===== Search Block ===== */
.search-block {
  background: var(--surface-ground, #f8f9fa);
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.search-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.search-block-header label {
  margin-bottom: 0 !important;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.search-or-hint {
  font-size: 0.75rem;
  color: var(--primary-color, #3b82f6);
  background: var(--blue-50, #eff6ff);
  border: 1px solid var(--blue-200, #bfdbfe);
  border-radius: 20px;
  padding: 1px 10px;
  font-weight: 500;
}
.search-field-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}
.search-field-row:last-child {
  margin-bottom: 0;
}
.search-field-badge {
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--primary-color, #3b82f6);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.search-input {
  flex: 1;
  min-width: 0;
}
.search-btn-remove,
.search-btn-add {
  flex-shrink: 0;
  width: 2rem !important;
  height: 2rem !important;
  padding: 0 !important;
}

/* ===== Promo text from HTML ===== */
.promo-text {
  font-size: 0.82rem;
  line-height: 1.4;
  color: #d97706;
  font-weight: 500;
}
:deep(.promo-text p) {
  margin: 0;
}
.filter-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--surface-border, #e5e7eb);
}
.multi-cond-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}
.dot-year-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding-top: 0.25rem;
}
.dot-year-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}
.price-range-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.expansion-content {
  padding: 1rem;
  background: #eef6ff;
  border-radius: 8px;
}
.expansion-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}
.expansion-header h4 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--primary-color, #3b82f6);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.expansion-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--surface-border, #e5e7eb);
  background: #fff;
  flex-shrink: 0;
}
:deep(.detail-table) {
  font-size: 0.9rem;
}
:deep(.detail-table .p-datatable-thead > tr > th) {
  background: #fdebd0 !important;
  font-weight: 600;
}

/* ===== Table Gridlines - Main Table ===== */
:deep(.balance-table .p-datatable-table) {
  border-collapse: collapse;
}
:deep(.balance-table .p-datatable-thead > tr > th) {
  border: 1px solid #d1d5db;
  border-bottom: 2px solid #9ca3af;
}
:deep(.balance-table .p-datatable-tbody > tr > td) {
  border: 1px solid #e5e7eb;
}
:deep(.balance-table .p-datatable-tfoot > tr > td) {
  border: 1px solid #d1d5db;
}

/* ===== Right-align header content for price columns ===== */
:deep(.header-align-right) {
  text-align: right;
}
:deep(.header-align-right .p-datatable-column-header-content) {
  justify-content: flex-end;
}

/* ===== Table Gridlines - Detail Table ===== */
:deep(.detail-table .p-datatable-table) {
  border-collapse: collapse;
}
:deep(.detail-table .p-datatable-thead > tr > th) {
  border: 1px solid #d1d5db;
  border-bottom: 2px solid #9ca3af;
}
:deep(.detail-table .p-datatable-tbody > tr > td) {
  border: 1px solid #e5e7eb;
}

.footer-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
}
.qty-input-row {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
.qty-btn {
  width: 1.8rem !important;
  height: 1.8rem !important;
  padding: 0 !important;
}
.qty-input {
  width: 2.5rem;
  text-align: center;
  border: 1px solid var(--surface-border, #d1d5db);
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 0.88rem;
  background: #fff;
}
.stock-filter-btn {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
:deep(.stock-filter-btn .p-selectbutton .p-button) {
  font-size: 0.82rem;
  padding: 0.3rem 0.75rem;
}
.row-not-orderable {
  opacity: 0.6;
}
.cart-action-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border, #e5e7eb);
}
.cart-total-label {
  font-size: 0.9rem;
  color: var(--text-color-secondary, #6c757d);
}
.expansion-promo {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  padding: 0.6rem 1rem;
  margin-bottom: 0.75rem;
  color: #b45309;
  font-size: 0.88rem;
  line-height: 1.6;
}
:deep(.expansion-promo p) {
  margin: 0;
}
.expansion-images {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border, #e5e7eb);
}
:deep(.galleria-expansion) {
  max-width: 480px;
  margin: 0 auto;
}
:deep(.galleria-expansion .p-galleria-thumbnail-container) {
  background: #f1f5f9;
  padding: 0.4rem;
  border-radius: 6px;
  margin-top: 0.5rem;
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

/* Quotation Cart */
.quotation-fab {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  width: 3.5rem !important;
  height: 3.5rem !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.quotation-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
  gap: 0.75rem;
  color: #999;
}
.quotation-item-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.quotation-item-card {
  background: var(--surface-ground, #f8f9fa);
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.quotation-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}
.quotation-item-code {
  font-weight: 700;
  color: var(--primary-color, #3b82f6);
}
.quotation-item-name {
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
}
.quotation-item-meta {
  font-size: 0.8rem;
  color: var(--text-color-secondary, #6c757d);
  margin-bottom: 0.5rem;
}
.quotation-item-controls {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.quotation-item-price {
  font-size: 0.85rem;
  color: #555;
}
.quotation-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-top: 1px solid var(--surface-border, #e5e7eb);
  padding-top: 0.75rem;
}
.quotation-footer-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.quotation-total-amount {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--green-600, #16a34a);
}
.quotation-footer-actions {
  display: flex;
  gap: 0.5rem;
}
.quotation-footer-actions .p-button {
  flex: 1;
}
.quotation-action-cell {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.print-only {
  display: none;
}
</style>

<style>
@media print {
  body > *:not(#app) {
    display: none !important;
  }
  #app > *:not(.balance-list-page),
  .balance-list-page > *:not(.print-only) {
    display: none !important;
  }
  .print-only {
    display: block !important;
    width: 100%;
    background: white;
    padding: 1.5cm 2cm;
    font-family: "TH Sarabun New", "Sarabun", sans-serif;
    font-size: 14pt;
    color: #000;
  }
  .print-header {
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
  }
  .print-header h2 {
    font-size: 18pt;
    margin: 0;
  }
  .print-customer-table {
    font-size: 12pt;
    margin-bottom: 1rem;
  }
  .print-customer-table td {
    padding: 2px 8px 2px 0;
    border: none;
  }
  .print-items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11pt;
    margin-bottom: 1rem;
  }
  .print-items-table th,
  .print-items-table td {
    border: 1px solid #333;
    padding: 5px 8px;
  }
  .print-items-table thead tr {
    background: #f0f0f0;
    font-weight: 700;
  }
  .print-footer {
    margin-top: 2rem;
  }
}
</style>
