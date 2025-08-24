<script setup>
import DocHistoryService from '@/services/DocHistoryService';
import Card from 'primevue/card';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();
const documents = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedDoc = ref(null);
const selectedDocDetails = ref(null);
const displayDocDetails = ref(false);
const loadingDetails = ref(false);
const summaryBalance = ref(0); // Add ref for summary balance

// เพิ่มตัวแปรเพื่อเก็บขนาดหน้าจอปัจจุบัน
const windowWidth = ref(window.innerWidth);

// ฟังก์ชันอัพเดทขนาดหน้าจอ
const updateWidth = () => {
    windowWidth.value = window.innerWidth;
};

// เพิ่ม event listener เมื่อโหลดคอมโพเนนต์
onMounted(() => {
    window.addEventListener('resize', updateWidth);
    updateWidth(); // เรียกครั้งแรกเพื่อตั้งค่าเริ่มต้น
});

// ลบ event listener เมื่อคอมโพเนนต์ถูกทำลาย
onUnmounted(() => {
    window.removeEventListener('resize', updateWidth);
});

// รหัสลูกค้า
const userData = JSON.parse(localStorage.getItem('_userData') || '{}');
const userCode = userData.user_code || '';

// ประเภทเอกสาร
const transTypes = {
    44: { label: 'การขาย', color: 'success', icon: 'pi pi-shopping-cart' },
    46: { label: 'เพิ่มหนี้', color: 'danger', icon: 'pi pi-arrow-up' },
    48: { label: 'ลดหนี้', color: 'warning', icon: 'pi pi-arrow-down' }
};

// สถานะเอกสาร
const documentStatus = {
    used: { label: 'อ้างอิงแล้ว', color: 'success', icon: 'pi pi-check-circle' },
    canceled: { label: 'ยกเลิก', color: 'danger', icon: 'pi pi-times-circle' },
    partialPayment: { label: 'อ้างอิงแล้ว', color: 'warning', icon: 'pi pi-percentage' }
};

// กรองเอกสาร
const filters = reactive({
    transFlag: '44',
    dateRange: null,
    searchTerm: ''
});

// ดึงข้อมูลเอกสารจาก API
async function fetchDocuments() {
    try {
        loading.value = true;
        error.value = null;

        if (!userCode) {
            router.push('/auth/login');
            return;
        }

        const response = await DocHistoryService.getDocList(userCode, filters.transFlag || '');

        if (response?.data?.success) {
            documents.value = response.data.data || [];
        } else {
            error.value = 'ไม่สามารถดึงข้อมูลเอกสารได้';
        }

        // Fetch total balance
        await fetchTotalBalance();
    } catch (err) {
        console.error('Error fetching document history:', err);
        error.value = 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร';
    } finally {
        loading.value = false;
    }
}

// ดึงยอดเงินคงค้างทั้งหมด
async function fetchTotalBalance() {
    try {
        if (!userCode) return;

        const response = await DocHistoryService.getTotalBalance(userCode);

        if (response?.data?.success) {
            // Update to directly use total_balance property from the response
            summaryBalance.value = response.data.total_balance || 0;
        } else {
            console.error('ไม่สามารถดึงข้อมูลยอดคงค้างได้');
        }
    } catch (err) {
        console.error('Error fetching total balance:', err);
    }
}

// ดึงรายละเอียดของเอกสาร
async function fetchDocDetails(docNo) {
    try {
        loadingDetails.value = true;
        const response = await DocHistoryService.getDocDetail(userCode, docNo);

        if (response?.data?.success) {
            selectedDoc.value = {
                ...selectedDoc.value,
                ...response.data.data
            };

            // เก็บเฉพาะรายการสินค้าลงใน selectedDocDetails
            selectedDocDetails.value = response.data.data.items || [];
            return true;
        }
        return false;
    } catch (err) {
        console.error('Error fetching document details:', err);
        return false;
    } finally {
        loadingDetails.value = false;
    }
}

// แสดงรายละเอียดเอกสาร
async function showDocDetails(doc) {
    selectedDoc.value = doc;
    displayDocDetails.value = true;
    selectedDocDetails.value = null;

    const success = await fetchDocDetails(doc.doc_no);
    if (!success) {
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: 'ไม่สามารถดึงรายละเอียดเอกสารได้',
            life: 3000
        });
    }
}

// ฟังก์ชันแปลงวันที่
function formatDate(dateStr, timeStr) {
    if (!dateStr) return '';

    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const date = new Date(year, month, day);

    const thaiDate = date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return timeStr ? `${thaiDate} ${timeStr} น.` : thaiDate;
}

// ฟอร์แมตตัวเลขเป็นรูปแบบเงินบาท
function formatCurrency(value) {
    if (value === undefined || value === null) return '0.00';
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(parseFloat(value));
}

// ฟังก์ชันเมื่อมีการเปลี่ยนแปลงประเภทเอกสาร
async function handleTransTypeChange() {
    fetchDocuments();
}

// ฟังก์ชันตรวจสอบสถานะเอกสาร
function getDocumentStatus(doc) {
    if (doc.last_status === '1') {
        return documentStatus.canceled;
    } else if (doc.inquiry_type === '0' && doc.ar_no && parseFloat(doc.balance) > 0) {
        return documentStatus.partialPayment;
    } else if ((doc.inquiry_type === '0' && doc.ar_no) || doc.inquiry_type === '1') {
        return documentStatus.used;
    }
    return null;
}

// คำนวณยอดที่ชำระแล้ว
function getPaidAmount(doc) {
    const totalAmount = parseFloat(doc.total_amount || 0);
    const balance = parseFloat(doc.balance || 0);

    if (balance > 0 && totalAmount > 0) {
        return totalAmount - balance;
    }

    return totalAmount;
}

// เอกสารที่ผ่านการกรอง
const filteredDocuments = computed(() => {
    if (!documents.value) return [];

    return documents.value.filter((doc) => {
        // กรองตามคำค้นหา
        if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            const docNoMatch = doc.doc_no.toLowerCase().includes(searchLower);
            const transTypeLabel = transTypes[doc.trans_flag]?.label.toLowerCase() || '';
            const transTypeMatch = transTypeLabel.includes(searchLower);
            const empNameMatch = doc.emp_name ? doc.emp_name.toLowerCase().includes(searchLower) : false;
            const custNameMatch = doc.cust_name ? doc.cust_name.toLowerCase().includes(searchLower) : false;

            return docNoMatch || transTypeMatch || empNameMatch || custNameMatch;
        }

        // กรองตามช่วงวันที่
        if (filters.dateRange && filters.dateRange.length === 2) {
            const docDate = new Date(doc.doc_date).setHours(0, 0, 0, 0);
            const startDate = new Date(filters.dateRange[0]).setHours(0, 0, 0, 0);
            const endDate = new Date(filters.dateRange[1]).setHours(23, 59, 59, 999);

            if (docDate < startDate || docDate > endDate) {
                return false;
            }
        }

        return true;
    });
});

// รีเซ็ตการกรอง
function resetFilters() {
    filters.transFlag = '44';
    filters.dateRange = null;
    filters.searchTerm = '';
    fetchDocuments();
}

// ดึงข้อมูลเมื่อโหลดคอมโพเนนต์
onMounted(fetchDocuments);
</script>
<template>
    <div class="doc-history-page">
        <div class="doc-history-container">
            <!-- Header -->
            <div class="page-header mb-4 flex justify-between">
                <div>
                    <h1 class="text-2xl font-bold">ประวัติเอกสาร</h1>
                    <p class="text-gray-500 dark:text-gray-400 mt-1">ตรวจสอบและดูรายละเอียดเอกสารของคุณ</p>
                </div>
                <!-- Summary Section -->
                <div>
                    <div class="flex flex-col md:items-end w-full">
                        <span class="text-sm text-gray-500 dark:text-gray-400">รวมยอดคงค้าง</span>
                        <span class="text-2xl font-bold text-red-500 mt-1">฿{{ formatCurrency(summaryBalance) }}</span>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="filters-container mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="block text-sm font-medium mb-1">ค้นหา</label>
                        <IconField iconPosition="left" class="w-full">
                            <InputText v-model="filters.searchTerm" placeholder="ค้นหาตามรหัสเอกสาร, ประเภท, พนักงาน..." class="w-full" />
                            <InputIcon class="pi pi-search" />
                        </IconField>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">ประเภทเอกสาร <span class="text-red-500">*</span></label>
                        <Dropdown
                            v-model="filters.transFlag"
                            :options="Object.keys(transTypes)"
                            optionLabel="label"
                            placeholder="เลือกประเภทเอกสาร"
                            class="w-full"
                            :class="{ 'p-invalid': !filters.transFlag && submitted }"
                            @change="handleTransTypeChange"
                            required
                        >
                            <template #value="slotProps">
                                <div v-if="slotProps.value" class="flex align-items-center">
                                    <span>{{ transTypes[slotProps.value].label }}</span>
                                </div>
                                <span v-else>เลือกประเภทเอกสาร</span>
                            </template>
                            <template #option="slotProps">
                                <div class="flex align-items-center">
                                    <span>{{ transTypes[slotProps.option].label }}</span>
                                </div>
                            </template>
                        </Dropdown>
                        <small v-if="!filters.transFlag && submitted" class="p-error">กรุณาเลือกประเภทเอกสาร</small>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">ช่วงวันที่</label>
                        <DatePicker v-model="filters.dateRange" selectionMode="range" dateFormat="dd/mm/yy" placeholder="เลือกช่วงวันที่" showIcon class="w-full" />
                    </div>
                </div>

                <div class="flex justify-end mt-3">
                    <Button label="ล้างตัวกรอง" icon="pi pi-filter-slash" class="p-button-outlined p-button-sm w-full" @click="resetFilters" />
                </div>
            </div>

            <!-- Loading state -->
            <div v-if="loading" class="flex justify-center items-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
            </div>

            <!-- Error state -->
            <div v-else-if="error" class="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <i class="pi pi-exclamation-triangle text-5xl text-yellow-500 mb-4"></i>
                <h3 class="text-xl font-medium mb-2">เกิดข้อผิดพลาด</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-4 text-center">{{ error }}</p>
                <Button label="ลองใหม่" icon="pi pi-refresh" @click="fetchDocuments" />
            </div>

            <!-- Empty state -->
            <div v-else-if="filteredDocuments.length === 0" class="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <i class="pi pi-file-o text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                <h3 class="text-xl font-medium mb-2">ไม่พบเอกสาร</h3>
                <p v-if="filters.transFlag || filters.dateRange || filters.searchTerm" class="text-gray-500 dark:text-gray-400 mb-4 text-center">ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา<br />ลองเปลี่ยนตัวกรองหรือล้างตัวกรองและลองอีกครั้ง</p>
                <p v-else class="text-gray-500 dark:text-gray-400 mb-4 text-center">คุณยังไม่มีประวัติเอกสาร</p>
            </div>

            <!-- Document list -->
            <div v-else class="documents-list grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                    v-for="doc in filteredDocuments"
                    :key="doc.doc_no"
                    class="shadow-md transition-all duration-200 hover:shadow-lg rounded-xl overflow-hidden"
                    :class="{
                        'border-left-4 border-success-500': doc.trans_flag === '44',
                        'border-left-4 border-danger-500': doc.trans_flag === '46',
                        'border-left-4 border-warning-500': doc.trans_flag === '48'
                    }"
                >
                    <!-- Header -->
                    <template #header>
                        <div
                            class="p-3 border-b"
                            :class="{
                                'bg-green-50 dark:bg-green-900/10': doc.trans_flag === '44',
                                'bg-red-50 dark:bg-red-900/10': doc.trans_flag === '46',
                                'bg-yellow-50 dark:bg-yellow-900/10': doc.trans_flag === '48'
                            }"
                        >
                            <div class="flex flex-col gap-1">
                                <!-- Document Code + Status -->
                                <div class="flex items-center justify-between">
                                    <div class="text-lg font-bold text-900">{{ doc.doc_no }}</div>
                                    <div class="flex items-center gap-1">
                                        <Tag :value="transTypes[doc.trans_flag]?.label" :severity="transTypes[doc.trans_flag]?.color" />
                                        <Tag v-if="getDocumentStatus(doc)" :value="getDocumentStatus(doc).label" :severity="getDocumentStatus(doc).color" />
                                        <span v-if="doc.last_status === '1'" class="text-danger-500 text-xs flex items-center"> <i class="pi pi-times-circle mr-1"></i>ยกเลิก </span>
                                    </div>
                                </div>

                                <!-- Date + Reference -->
                                <div class="flex flex-wrap text-sm text-600 gap-3">
                                    <span><i class="pi pi-calendar mr-1"></i>{{ formatDate(doc.doc_date) }}</span>
                                    <span v-if="doc.ar_no"><i class="pi pi-file-edit mr-1"></i>{{ doc.ar_no }}</span>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- Content -->
                    <template #content>
                        <div class="p-3 space-y-3">
                            <!-- Section: Customer & Employee -->
                            <div>
                                <div class="text-sm font-semibold mb-2 text-800">ข้อมูลลูกค้า / พนักงาน</div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="flex items-center gap-2">
                                        <i class="pi pi-user text-primary text-sm"></i>
                                        <div class="text-sm truncate" :title="`${doc.cust_code} ~ ${doc.cust_name}`">{{ doc.cust_code }} ~ {{ doc.cust_name }}</div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <i class="pi pi-id-card text-primary text-sm"></i>
                                        <div class="text-sm truncate" :title="`${doc.emp_code} ~ ${doc.emp_name}`">{{ doc.emp_code }} ~ {{ doc.emp_name }}</div>
                                    </div>
                                </div>
                            </div>

                            <hr class="my-1 border-gray-200" />

                            <!-- Section: Payment -->
                            <div>
                                <div class="text-sm font-semibold mb-2 text-800">ข้อมูลการชำระเงิน</div>
                                <div class="space-y-1">
                                    <div class="flex justify-between text-sm">
                                        <span class="text-600">รวม:</span>
                                        <span class="font-bold text-primary">฿{{ formatCurrency(doc.total_amount) }}</span>
                                    </div>
                                    <div v-if="parseFloat(doc.balance) > 0">
                                        <div class="flex justify-between text-sm">
                                            <span class="text-600">ชำระแล้ว:</span>
                                            <span class="text-success">฿{{ formatCurrency(getPaidAmount(doc)) }}</span>
                                        </div>
                                        <div class="flex justify-between text-sm">
                                            <span class="text-600">คงเหลือ:</span>
                                            <span class="text-warning">฿{{ formatCurrency(doc.balance) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr class="my-1 border-gray-200" />

                            <!-- Section: Delivery & Remark -->
                            <div class="flex flex-wrap gap-2 text-xs">
                                <div class="flex items-center bg-gray-100 dark:bg-gray-800/30 px-2 py-1 rounded-md">
                                    <i class="pi pi-truck text-primary mr-1"></i>
                                    <span>{{ doc.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน' }}</span>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- Footer -->
                    <template #footer>
                        <div
                            class="p-2 border-t flex justify-between items-end"
                            :class="{
                                'bg-green-50/60 dark:bg-green-900/5': doc.trans_flag === '44',
                                'bg-red-50/60 dark:bg-red-900/5': doc.trans_flag === '46',
                                'bg-yellow-50/60 dark:bg-yellow-900/5': doc.trans_flag === '48'
                            }"
                        >
                            <div class="flex items-center bg-gray-100 dark:bg-gray-800/30 px-2 py-1 rounded-md max-w-[200px] truncate" :title="doc.remark">
                                <i v-if="doc.remark != ''" class="pi pi-bookmark text-primary mr-1"></i>
                                <span>{{ doc.remark }}</span>
                            </div>
                            <Button label="รายละเอียด" icon="pi pi-eye" class="p-button-sm p-button-primary" @click="showDocDetails(doc)" />
                        </div>
                    </template>
                </Card>
            </div>

            <!-- Document details dialog -->
            <Dialog v-model:visible="displayDocDetails" :header="`เอกสารเลขที่: ${selectedDoc?.doc_no || ''}`" :style="{ width: '90%', maxWidth: '900px' }" :modal="true" :closeOnEscape="true" :dismissableMask="true">
                <!-- Loading state for details -->
                <div v-if="loadingDetails" class="flex justify-center items-center p-8">
                    <ProgressSpinner strokeWidth="4" style="width: 50px; height: 50px" />
                </div>

                <div v-else-if="selectedDoc" class="doc-details">
                    <!-- Doc Status and Basic Info -->
                    <div class="flex flex-col md:flex-row gap-4 mb-4">
                        <div
                            class="status-container p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex-1"
                            :class="{
                                'bg-green-50 dark:bg-green-900/20': selectedDoc.trans_flag === '44',
                                'bg-red-50 dark:bg-red-900/20': selectedDoc.trans_flag === '46',
                                'bg-yellow-50 dark:bg-yellow-900/20': selectedDoc.trans_flag === '48',
                                'bg-gray-50 dark:bg-gray-800': !selectedDoc.trans_flag || !transTypes[selectedDoc.trans_flag]
                            }"
                        >
                            <div class="flex items-center">
                                <i :class="[transTypes[selectedDoc.trans_flag]?.icon || 'pi pi-file', 'text-xl mr-2', `text-${transTypes[selectedDoc.trans_flag]?.color || 'primary'}-500`]"></i>
                                <span class="font-semibold">{{ transTypes[selectedDoc.trans_flag]?.label || 'เอกสาร' }}</span>

                                <!-- แสดงสถานะเอกสาร (เพิ่มใหม่) -->
                                <Tag v-if="getDocumentStatus(selectedDoc)" :value="getDocumentStatus(selectedDoc).label" :severity="getDocumentStatus(selectedDoc).color" class="text-xs ml-2" />
                            </div>
                            <div class="flex flex-col sm:flex-row sm:gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <div class="mb-1 sm:mb-0"><i class="pi pi-calendar mr-1"></i> {{ formatDate(selectedDoc.doc_date, selectedDoc.doc_time) }}</div>
                                <div v-if="selectedDoc.ar_no" class="mb-1 sm:mb-0"><i class="pi pi-file-edit mr-1"></i> เลขที่อ้างอิง: {{ selectedDoc.ar_no }}</div>
                            </div>
                        </div>

                        <div class="payment-summary p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 flex-1">
                            <div class="font-semibold mb-1">สรุปการชำระเงิน</div>
                            <div class="flex justify-between text-sm">
                                <span>ยอดลดหนี้รวม:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedDoc.cn_total_amount || 0) }}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span>ยอดรวม:</span>
                                <span class="font-medium">฿{{ formatCurrency(selectedDoc.total_amount) }}</span>
                            </div>

                            <!-- แสดงส่วนลด (เพิ่มใหม่) -->
                            <div v-if="parseFloat(selectedDoc.total_discount) > 0" class="flex justify-between text-sm mt-1">
                                <span>ส่วนลด:</span>
                                <span class="font-medium text-success">฿{{ formatCurrency(selectedDoc.total_discount) }}</span>
                            </div>

                            <!-- แสดงยอดชำระแล้วและยอดคงเหลือ (เพิ่มใหม่) -->
                            <template v-if="parseFloat(selectedDoc.balance) > 0">
                                <div class="flex justify-between text-sm mt-1">
                                    <span>ชำระแล้ว:</span>
                                    <span class="font-medium text-success">฿{{ formatCurrency(getPaidAmount(selectedDoc)) }}</span>
                                </div>
                                <div class="flex justify-between text-sm mt-1">
                                    <span>คงเหลือ:</span>
                                    <span class="font-medium text-warning">฿{{ formatCurrency(selectedDoc.balance) }}</span>
                                </div>
                            </template>
                        </div>
                    </div>

                    <!-- Customer and Employee Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 class="text-lg font-semibold mb-2 flex items-center">
                                <i class="pi pi-user mr-2 text-primary-500"></i>
                                ข้อมูลลูกค้า
                            </h3>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="text-sm text-gray-500">รหัสลูกค้า:</div>
                                <div class="text-sm font-medium">{{ selectedDoc.cust_code }}</div>

                                <div class="text-sm text-gray-500">ชื่อลูกค้า:</div>
                                <div class="text-sm font-medium">{{ selectedDoc.cust_name }}</div>

                                <div class="text-sm text-gray-500">ประเภทการรับสินค้า:</div>
                                <div class="text-sm font-medium">
                                    <Tag :severity="selectedDoc.send_type === '1' ? 'info' : 'success'" :value="selectedDoc.send_type === '1' ? 'จัดส่ง' : 'รับที่ร้าน'" />
                                </div>
                            </div>
                        </div>

                        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 class="text-lg font-semibold mb-2 flex items-center">
                                <i class="pi pi-briefcase mr-2 text-primary-500"></i>
                                ข้อมูลพนักงาน
                            </h3>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="text-sm text-gray-500">รหัสพนักงาน:</div>
                                <div class="text-sm font-medium">{{ selectedDoc.emp_code || '-' }}</div>

                                <div class="text-sm text-gray-500">ชื่อพนักงาน:</div>
                                <div class="text-sm font-medium">{{ selectedDoc.emp_name || 'ไม่มีพนักงานดูแล' }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- สถานะเอกสาร (เพิ่มใหม่) -->
                    <div v-if="getDocumentStatus(selectedDoc) || parseFloat(selectedDoc.balance) > 0 || parseFloat(selectedDoc.total_discount) > 0" class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-info-circle mr-2 text-primary-500"></i>
                            ข้อมูลสถานะและการชำระเงิน
                        </h3>
                        <div class="grid grid-cols-2 gap-2">
                            <!-- สถานะเอกสาร -->
                            <div v-if="getDocumentStatus(selectedDoc)" class="col-span-2">
                                <div class="text-sm text-gray-500">สถานะเอกสาร:</div>
                                <div class="text-sm font-medium flex items-center">
                                    <i :class="[getDocumentStatus(selectedDoc).icon, 'mr-2', `text-${getDocumentStatus(selectedDoc).color}`]"></i>
                                    {{ getDocumentStatus(selectedDoc).label }}
                                </div>
                            </div>

                            <!-- ยอดชำระและคงเหลือ -->
                            <div v-if="parseFloat(selectedDoc.balance) > 0" class="text-sm text-gray-500">ยอดชำระแล้ว:</div>
                            <div v-if="parseFloat(selectedDoc.balance) > 0" class="text-sm font-medium text-success">฿{{ formatCurrency(getPaidAmount(selectedDoc)) }}</div>

                            <div v-if="parseFloat(selectedDoc.balance) > 0" class="text-sm text-gray-500">ยอดคงเหลือ:</div>
                            <div v-if="parseFloat(selectedDoc.balance) > 0" class="text-sm font-medium text-warning">฿{{ formatCurrency(selectedDoc.balance) }}</div>

                            <!-- ส่วนลด -->
                            <div v-if="parseFloat(selectedDoc.total_discount) > 0" class="text-sm text-gray-500">ส่วนลด:</div>
                            <div v-if="parseFloat(selectedDoc.total_discount) > 0" class="text-sm font-medium text-success">฿{{ formatCurrency(selectedDoc.total_discount) }}</div>

                            <!-- ข้อความส่วนลด -->
                            <div v-if="selectedDoc.discount_word" class="col-span-2">
                                <div class="text-sm text-gray-500">รายละเอียดส่วนลด:</div>
                                <div class="text-sm font-medium">{{ selectedDoc.discount_word }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Document Items -->
                    <div v-if="selectedDocDetails && selectedDocDetails.length > 0" class="mb-4">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-list mr-2 text-primary-500"></i>
                            รายการสินค้า
                        </h3>

                        <!-- Desktop Table (visible based on screen width using JS) -->
                        <div v-if="windowWidth >= 500" class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div class="bg-gray-50 dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 text-sm font-medium">
                                <div class="grid grid-cols-12 gap-2">
                                    <div class="col-span-5">สินค้า</div>
                                    <div class="col-span-2">หน่วย</div>
                                    <div class="col-span-2 text-right">ราคา</div>
                                    <div class="col-span-1 text-right">จำนวน</div>
                                    <div class="col-span-2 text-right">รวม</div>
                                </div>
                            </div>

                            <div class="divide-y divide-gray-100 dark:divide-gray-700">
                                <div v-for="(item, index) in selectedDocDetails" :key="index" class="p-3">
                                    <div class="grid grid-cols-12 gap-2 items-center">
                                        <div class="col-span-5">
                                            <div class="font-medium text-primary-600 dark:text-primary-400">
                                                {{ item.item_name }} <span class="text-sm text-blue-500 dark:text-white">[{{ item.shelf_code }}]</span>
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">รหัส: {{ item.item_code }}</div>
                                        </div>
                                        <div class="col-span-2">{{ item.unit_code }}</div>
                                        <div class="col-span-2 text-right">฿{{ formatCurrency(item.price) }}</div>
                                        <div class="col-span-1 text-right">{{ item.qty }}</div>
                                        <div class="col-span-2 text-right font-semibold">฿{{ formatCurrency(item.sum_amount) }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Card View (visible based on screen width using JS) -->
                        <div v-else class="document-items-cards">
                            <div v-for="(item, index) in selectedDocDetails" :key="index" class="mb-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="font-medium text-primary-600 dark:text-primary-400">
                                        {{ item.item_name }} <span class="text-sm text-blue-500 dark:text-white">[{{ item.shelf_code }}]</span>
                                    </div>
                                    <div class="font-semibold">฿{{ formatCurrency(item.sum_amount) }}</div>
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">รหัส: {{ item.item_code }}</div>
                                <div class="grid grid-cols-3 text-sm mt-2">
                                    <div>
                                        <div class="text-gray-500 mb-1">หน่วย</div>
                                        <div>{{ item.unit_code }}</div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500 mb-1">ราคา</div>
                                        <div>฿{{ formatCurrency(item.price) }}</div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500 mb-1">จำนวน</div>
                                        <div>{{ item.qty }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Document Items Summary -->
                        <div class="bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg mt-2">
                            <div class="grid grid-cols-12 gap-2">
                                <!-- ส่วนลด (เพิ่มใหม่) -->
                                <div v-if="parseFloat(selectedDoc.total_discount) > 0" class="col-span-9 text-right font-medium text-gray-500">ส่วนลด:</div>
                                <div v-if="parseFloat(selectedDoc.total_discount) > 0" class="col-span-3 text-right font-medium text-success">฿{{ formatCurrency(selectedDoc.total_discount) }}</div>

                                <div class="col-span-9 text-right font-medium">รวมทั้งสิ้น:</div>
                                <div class="col-span-3 text-right font-bold text-primary-600 dark:text-primary-400">฿{{ formatCurrency(selectedDoc.total_amount) }}</div>

                                <!-- ชำระแล้ว (เพิ่มใหม่) -->
                                <div v-if="parseFloat(selectedDoc.balance) > 0" class="col-span-9 text-right font-medium text-gray-500">ชำระแล้ว:</div>
                                <div v-if="parseFloat(selectedDoc.balance) > 0" class="col-span-3 text-right font-medium text-success">฿{{ formatCurrency(getPaidAmount(selectedDoc)) }}</div>

                                <!-- คงเหลือ (เพิ่มใหม่) -->
                                <div v-if="parseFloat(selectedDoc.balance) > 0" class="col-span-9 text-right font-medium text-gray-500">คงเหลือ:</div>
                                <div v-if="parseFloat(selectedDoc.balance) > 0" class="col-span-3 text-right font-medium text-warning">฿{{ formatCurrency(selectedDoc.balance) }}</div>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="!loadingDetails" class="mb-4 flex items-center justify-center p-6 border border-yellow-200 bg-yellow-50 rounded-lg text-yellow-800">
                        <i class="pi pi-exclamation-triangle mr-2"></i>
                        <span>ไม่พบรายการสินค้าในเอกสารนี้</span>
                    </div>

                    <!-- Document Notes -->
                    <!-- Document Notes -->
                    <div v-if="selectedDoc.remark" class="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h3 class="text-lg font-semibold mb-2 flex items-center">
                            <i class="pi pi-comment mr-2 text-primary-500"></i>
                            หมายเหตุ
                        </h3>
                        <p class="text-sm">{{ selectedDoc.remark }}</p>
                    </div>

                    <!-- แสดงแบนเนอร์เมื่อเอกสารถูกยกเลิก (เพิ่มใหม่) -->
                    <div v-if="selectedDoc.last_status === '1'" class="mb-4 p-4 border border-red-200 bg-red-50 rounded-lg">
                        <div class="flex items-center text-red-600">
                            <i class="pi pi-times-circle text-xl mr-2"></i>
                            <span class="font-semibold">เอกสารนี้ถูกยกเลิกแล้ว</span>
                        </div>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-end gap-2">
                        <Button label="ปิด" icon="pi pi-times" outlined @click="displayDocDetails = false" />
                    </div>
                </template>
            </Dialog>
        </div>
    </div>
</template>
<style scoped>
/* Custom border styles for document cards */
.status-info {
    border-left-color: var(--blue-500) !important;
}
.status-success {
    border-left-color: var(--green-500) !important;
}
.status-danger {
    border-left-color: var(--red-500) !important;
}
.status-warning {
    border-left-color: var(--yellow-500) !important;
}

/* เพิ่มสไตล์สำหรับการแสดงสถานะเอกสาร */
.document-status {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.25rem;
}
.document-status i {
    margin-right: 0.25rem;
}
.document-status.canceled {
    background-color: var(--red-50);
    color: var(--red-600);
}
.document-status.used {
    background-color: var(--green-50);
    color: var (--green-600);
}
.document-status.partial {
    background-color: var(--yellow-50);
    color: var(--yellow-600);
}
</style>
