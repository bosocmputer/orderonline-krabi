<script setup>
import WarehouseService from '@/services/WarehouseList';
import { onMounted, ref } from 'vue';

// ตัวแปรสถานะ
const isEmployee = ref(false);
const employeeData = ref(null);
const userData = ref(null);
const storeName = ref('');

const warehouseName = ref('');
const warehouseCode = ref('');

// ตัวแปรสำหรับเปลี่ยนคลัง
const showWarehouseDialog = ref(false);
const selectedWarehouse = ref(null);
const warehouseOptions = ref([]);
const allWarehouseOptions = ref([]);
const isLoadingWarehouses = ref(false);
const saleTypeName = ref('');
const saleType = ref(1);

// ตัวแปรสำหรับเปลี่ยนประเภทการขาย
const showSaleTypeDialog = ref(false);
const selectedSaleType = ref({});
const saleTypeOptions = ref([
    { value: 1, name: 'เงินสด' },
    { value: 2, name: 'เงินเชื่อ' }
]);

// ฟังก์ชันโหลดรายการคลัง
const loadWarehouses = async () => {
    try {
        isLoadingWarehouses.value = true;
        const response = await WarehouseService.getWarehouseList();

        if (response && response.success && Array.isArray(response.data)) {
            warehouseOptions.value = response.data;
            allWarehouseOptions.value = response.data;
        } else {
            warehouseOptions.value = [];
            allWarehouseOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลคลัง:', error);
        warehouseOptions.value = [];
        allWarehouseOptions.value = [];
    } finally {
        isLoadingWarehouses.value = false;
    }
};

// ฟังก์ชัน filter คลัง
const filterWarehouses = (event) => {
    const searchTerm = (event.value || '').trim();
    const searchTermLower = searchTerm.toLowerCase();

    if (!searchTerm) {
        warehouseOptions.value = [...allWarehouseOptions.value];
        return;
    }

    warehouseOptions.value = allWarehouseOptions.value.filter((warehouse) => {
        const code = (warehouse.code || '').toLowerCase();
        const name = (warehouse.name || '').toLowerCase();

        const matched = code.includes(searchTermLower) || name.includes(searchTermLower);
        // console.log('Filtering warehouse:', { code, name, searchTermLower, matched });
        return matched;
    });

    // console.log('Filtered warehouses count:', warehouseOptions.value.length, warehouseOptions.value);
};

// ฟังก์ชันเปิด dialog เปลี่ยนคลัง
const openChangeWarehouseDialog = async () => {
    await loadWarehouses();
    // ตั้งค่าคลังปัจจุบันเป็นค่าเริ่มต้น
    if (warehouseCode.value) {
        selectedWarehouse.value = warehouseOptions.value.find((w) => w.code === warehouseCode.value) || null;
    }
    showWarehouseDialog.value = true;
};

// ฟังก์ชันยืนยันการเปลี่ยนคลัง
const confirmChangeWarehouse = () => {
    if (!selectedWarehouse.value) {
        alert('กรุณาเลือกคลัง');
        return;
    }

    // บันทึกข้อมูลคลังใหม่ลง localStorage
    localStorage.setItem('_selectedWarehouse', JSON.stringify(selectedWarehouse.value));
    localStorage.setItem('_warehouseCode', selectedWarehouse.value.code);
    localStorage.setItem('_warehouseName', selectedWarehouse.value.name);

    // อัพเดตค่าแสดงผล
    warehouseCode.value = selectedWarehouse.value.code;
    warehouseName.value = selectedWarehouse.value.name;

    // ปิด dialog
    showWarehouseDialog.value = false;

    // รีโหลดหน้าเพื่อให้ข้อมูลอัพเดต
    window.location.reload();
};

// ฟังก์ชันเปิด dialog เปลี่ยนประเภทการขาย
const openChangeSaleTypeDialog = () => {
    console.log('Current Sale Type:', saleType.value, saleTypeName.value);
    selectedSaleType.value = { value: saleType.value, name: saleTypeName.value };
    showSaleTypeDialog.value = true;
};

// ฟังก์ชันยืนยันการเปลี่ยนประเภทการขาย
const confirmChangeSaleType = () => {
    if (!selectedSaleType.value) {
        alert('กรุณาเลือกประเภทการขาย');
        return;
    }
    console.log('saleTypeOptions Sale Type Option:', saleTypeOptions.value);

    const selectedOption = saleTypeOptions.value.find((s) => s.value === selectedSaleType.value.value);
    console.log('Selected Sale Type Option:', selectedOption);
    // บันทึกข้อมูลประเภทการขายใหม่ลง localStorage
    localStorage.setItem('_saleType', selectedOption.value.toString());
    localStorage.setItem('_saleTypeName', selectedOption?.name || '');

    // อัพเดตค่าแสดงผล
    saleType.value = parseInt(selectedOption.value);
    saleTypeName.value = selectedOption?.name || '';

    // ปิด dialog
    showSaleTypeDialog.value = false;

    // รีโหลดหน้าเพื่อให้ข้อมูลอัพเดต
    // window.location.reload();
};

// ดึงข้อมูลเมื่อคอมโพเนนต์ถูกโหลด
onMounted(() => {
    // ตรวจสอบว่าผู้ใช้เป็นพนักงานหรือไม่
    const userType = localStorage.getItem('_userType');
    isEmployee.value = userType === 'employee';

    warehouseCode.value = localStorage.getItem('_warehouseCode') ?? '';
    warehouseName.value = localStorage.getItem('_warehouseName') ?? '';
    saleTypeName.value = localStorage.getItem('_saleTypeName') || '';
    console.log('Loaded Sale Type from localStorage:', localStorage.getItem('_saleType'));
    saleType.value = parseInt(localStorage.getItem('_saleType') || 1);

    // ถ้าผู้ใช้เป็นพนักงาน ให้ดึงข้อมูลพนักงาน
    if (isEmployee.value) {
        const empDataStr = localStorage.getItem('_empData');
        const userDataStr = localStorage.getItem('_userData');

        if (empDataStr) {
            try {
                employeeData.value = JSON.parse(empDataStr);
            } catch (e) {
                console.error('Error parsing employee data:', e);
            }
        }

        if (userDataStr) {
            try {
                userData.value = JSON.parse(userDataStr);
                // ดึงชื่อร้านค้าจากข้อมูลผู้ใช้
                storeName.value = userData.value.user_name || '';
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
    }
});
</script>

<template>
    <!-- แสดงข้อมูลพนักงาน -->
    <div v-if="isEmployee && (employeeData || userData)" class="user-info employee-info">
        <div class="user-profile">
            <div class="user-welcome">
                <span class="welcome-text">คลัง</span>
                <div class="warehouse-row">
                    <span class="user-name">{{ warehouseCode }} ~ {{ warehouseName }}</span>
                    <Button icon="pi pi-sync" text rounded size="small" @click="openChangeWarehouseDialog" v-tooltip.top="'เปลี่ยนคลัง'" class="change-warehouse-btn" />
                </div>

                <span class="welcome-text">ประเภทการขาย</span>
                <div class="warehouse-row">
                    <span class="user-name">{{ saleTypeName }}</span>
                    <Button icon="pi pi-sync" text rounded size="small" @click="openChangeSaleTypeDialog" v-tooltip.top="'เปลี่ยนประเภทการขาย'" class="change-warehouse-btn" />
                </div>

                <span class="welcome-text">พนักงาน</span>
                <span class="user-name">{{ employeeData?.user_code }} ~ {{ employeeData?.user_name }}</span>
                <span class="welcome-text">คุณกำลังเปิดบิลร้าน </span>
                <span class="user-name">{{ userData?.user_code }} ~ {{ userData?.user_name }}</span>
            </div>
        </div>
    </div>

    <!-- Dialog เปลี่ยนคลัง -->
    <Dialog v-model:visible="showWarehouseDialog" header="เปลี่ยนคลัง" :modal="true" :style="{ width: '400px' }" :closable="true">
        <div class="p-fluid">
            <div class="field">
                <label for="warehouse" class="font-medium mb-2 block">เลือกคลัง</label>
                <Select
                    id="warehouse"
                    v-model="selectedWarehouse"
                    :options="warehouseOptions"
                    optionLabel="name"
                    placeholder="เลือกคลัง"
                    class="w-full"
                    :loading="isLoadingWarehouses"
                    filter
                    :filterFields="['code', 'name']"
                    @filter="filterWarehouses"
                    filterPlaceholder="พิมพ์ชื่อหรือรหัสคลัง"
                >
                    <template #value="slotProps">
                        <div v-if="slotProps.value" class="flex items-center">
                            <i class="pi pi-building mr-2 text-primary"></i>
                            <div>{{ slotProps.value.code }} ~ {{ slotProps.value.name }}</div>
                        </div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                    <template #option="slotProps">
                        <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                            <div class="font-bold">{{ slotProps.option.code }}~</div>
                            <div>{{ slotProps.option.name }}</div>
                        </div>
                    </template>
                </Select>
            </div>
        </div>

        <template #footer>
            <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showWarehouseDialog = false" />
            <Button label="ยืนยัน" icon="pi pi-check" severity="success" @click="confirmChangeWarehouse" :disabled="!selectedWarehouse" />
        </template>
    </Dialog>

    <!-- Dialog เปลี่ยนประเภทการขาย -->
    <Dialog v-model:visible="showSaleTypeDialog" header="เปลี่ยนประเภทการขาย" :modal="true" :style="{ width: '400px' }" :closable="true">
        <div class="p-fluid">
            <div class="field">
                <label for="saleType" class="font-medium mb-2 block">เลือกประเภทการขาย</label>
                <Select id="saleType" v-model="selectedSaleType" :options="saleTypeOptions" optionLabel="name" placeholder="เลือกประเภทการขาย" class="w-full">
                    <template #value="slotProps">
                        <div v-if="slotProps.value" class="flex items-center">
                            <i class="pi pi-tag mr-2 text-primary"></i>
                            <div>{{ slotProps.value.name }}</div>
                        </div>
                        <span v-else>{{ slotProps.placeholder }}</span>
                    </template>
                    <template #option="slotProps">
                        <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                            <div class="font-bold">{{ slotProps.option.name }}</div>
                        </div>
                    </template>
                </Select>
            </div>
        </div>

        <template #footer>
            <Button label="ยกเลิก" icon="pi pi-times" severity="secondary" outlined @click="showSaleTypeDialog = false" />
            <Button label="ยืนยัน" icon="pi pi-check" severity="success" @click="confirmChangeSaleType" :disabled="!selectedSaleType" />
        </template>
    </Dialog>
</template>

<style lang="scss" scoped>
.user-info {
    padding: 1rem;
    margin-bottom: 1rem;
    background-color: var(--surface-card, #ffffff);
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    i {
        font-size: 1.5rem;
        color: var(--primary-color, #3b82f6);
        background-color: var(--primary-50, #eff6ff);
        border-radius: 50%;
        padding: 0.5rem;
    }

    .user-welcome {
        display: flex;
        flex-direction: column;

        .warehouse-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;

            .change-warehouse-btn {
                padding: 0.25rem;
                width: 1.5rem;
                height: 1.5rem;
            }
        }

        .welcome-text {
            font-size: 0.875rem;
            color: var(--text-color-secondary, #6c757d);
        }

        .user-name {
            font-weight: 600;
            font-size: 0.875rem;
            color: var(--text-color, #495057);
        }
    }
}
</style>
