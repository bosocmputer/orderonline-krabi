<!-- eslint-disable no-unused-vars -->
<script setup>
import CartService from '@/services/CartService';
import CustomerService from '@/services/CustomerService';
import DocHistoryService from '@/services/DocHistoryService'; // Import the DocHistoryService
import EmployeeService from '@/services/EmployeeService';
import ProductService from '@/services/ProductService';
import { computed, onMounted, ref, watch } from 'vue';
// Note: defineProps and defineEmits are compiler macros and don't need to be imported

const props = defineProps({
    cartItems: {
        type: Array,
        required: true
    },
    userType: {
        type: String,
        default: ''
    },
    userData: {
        type: Object,
        default: () => ({})
    },
    orderData: {
        type: Object,
        default: () => ({
            deliveryMethod: 'pickup',
            employeeCode: '',
            customerCode: '',
            deliveryAddress: '',
            deliveryTelephone: ''
        })
    },
    totals: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['prev-step', 'process-checkout']);

// Local states
const isCheckingOut = ref(false);
const errorMessage = ref('');
const confirmedItems = ref([]);
const addressType = ref('current'); // 'current' หรือ 'custom'
const currentAddress = computed(() => {
    return props.userData.address || '';
});
const currentTelephone = computed(() => {
    return props.userData.telephone || '';
});

// เพิ่มตัวแปรสำหรับที่อยู่ที่ระบุเอง
const customAddress = ref('');
const customTelephone = ref('');

// Advance payment data
const advancePayments = ref([]);
const isLoadingAdvancePayments = ref(false);

// Selected advance payments
const selectedAdvancePayments = ref([]);

// Form data
const formData = ref({
    deliveryMethod: props.orderData.deliveryMethod,
    employeeCode: props.orderData.employeeCode,
    customerCode: props.orderData.customerCode || '',
    deliveryAddress: props.orderData.deliveryAddress || props.userData.address || '',
    deliveryTelephone: props.orderData.deliveryTelephone || props.userData.telephone || '',
    // เพิ่มฟิลด์ใหม่สำหรับ API
    send_type: props.orderData.deliveryMethod === 'delivery' ? '1' : '0',
    address: props.userData.address || '',
    address_name: 'ใช้ที่อยู่ปัจจุบัน',
    remark: props.orderData.remark || ''
});

// เพิ่มตัวแปรเพื่อป้องกันการกดปุ่มซ้ำ
const isSubmitting = ref(false);

// Employee selection
const selectedEmployee = ref(null);
const isSearchingEmployee = ref(false);
const employeeOptions = ref([]);
const selectedEmployeeCode = ref(localStorage.getItem('_empCode') || '');

// Customer selection
const selectedCustomer = ref(null);
const isSearchingCustomer = ref(false);
const customerOptions = ref([]);
const selectedCustomerCode = ref(localStorage.getItem('_userCode') || '');

// Terms and conditions
const termsDialog = ref(false);
const termsAccepted = ref(false);

watch(addressType, () => {
    handleAddressTypeChange();
});

// Update the watch for deliveryMethod to set send_type
watch(
    () => formData.value.deliveryMethod,
    (newValue) => {
        formData.value.send_type = newValue === 'delivery' ? '1' : '0';
    }
);

watch([customAddress, customTelephone], () => {
    if (addressType.value === 'custom') {
        formData.value.deliveryAddress = customAddress.value;
        formData.value.deliveryTelephone = customTelephone.value;
    }
});

// Update remark when advance payments are selected
watch(selectedAdvancePayments, (newValue) => {
    updateRemarkWithAdvancePayments();
});

onMounted(async () => {
    try {
        // ดึงข้อมูลราคายืนยัน
        if (props.userData && props.userData.user_code) {
            const response = await CartService.getCartOrder(props.userData.user_code);
            if (response && response.data && response.data.data) {
                confirmedItems.value = response.data.data;
                console.log('Confirmed items with tax_type:', confirmedItems.value);
            }

            // ดึงข้อมูลเงินล่วงหน้า
            await loadAdvancePayments(props.userData.user_code);
        }

        customAddress.value = props.userData.address || '';
        customTelephone.value = props.userData.telephone || '';

        // ตั้งค่าเริ่มต้นให้เลือกใช้ที่อยู่ปัจจุบัน (ถ้ามี)
        if (currentAddress.value) {
            addressType.value = 'current';
            handleAddressTypeChange();
        } else {
            addressType.value = 'custom';
        }

        // ดึงข้อมูลพนักงานและลูกค้า
        if (selectedEmployeeCode.value) {
            formData.value.employeeCode = selectedEmployeeCode.value;
        }

        if (selectedCustomerCode.value) {
            formData.value.customerCode = selectedCustomerCode.value;
        }

        await Promise.all([loadInitialEmployees()]);
        // await Promise.all([loadInitialEmployees(), loadInitialCustomers()]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
    }
});

// โหลดข้อมูลพนักงานเริ่มต้น
const loadInitialEmployees = async () => {
    try {
        isSearchingEmployee.value = true;
        const data = await EmployeeService.getEmployees('', 50);

        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;

            if (selectedEmployeeCode.value) {
                selectedEmployee.value = data.find((emp) => emp.code === selectedEmployeeCode.value) || null;
            }
        } else {
            employeeOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน:', error);
        employeeOptions.value = [];
    } finally {
        isSearchingEmployee.value = false;
    }
};

// ค้นหาพนักงาน
const filterEmployees = async (event) => {
    try {
        isSearchingEmployee.value = true;
        const searchTerm = event.value || '';

        if (searchTerm.trim().length < 2) {
            await loadInitialEmployees();
            return;
        }

        const data = await EmployeeService.getEmployees(searchTerm, 100);

        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;
        } else {
            employeeOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาพนักงาน:', error);
        employeeOptions.value = [];
    } finally {
        isSearchingEmployee.value = false;
    }
};

// เมื่อมีการเลือกพนักงาน
const onEmployeeSelect = (employee) => {
    if (employee) {
        formData.value.employeeCode = employee.code;
        localStorage.setItem('_empCode', selectedEmployee.value.code);
        localStorage.setItem('_empData', JSON.stringify(selectedEmployee.value));
    } else {
        formData.value.employeeCode = '';
        localStorage.removeItem('_empCode');
        localStorage.removeItem('_empData');
    }
};

function handleAddressTypeChange() {
    if (addressType.value === 'current') {
        // ใช้ที่อยู่ปัจจุบัน
        formData.value.deliveryAddress = currentAddress.value;
        formData.value.deliveryTelephone = currentTelephone.value;
        formData.value.address = currentAddress.value;
        formData.value.address_name = 'ใช้ที่อยู่ปัจจุบัน';
    } else {
        // ใช้ที่อยู่ที่ระบุเอง
        formData.value.deliveryAddress = customAddress.value;
        formData.value.deliveryTelephone = customTelephone.value;
        formData.value.address = customAddress.value;
        formData.value.address_name = 'ระบุที่อยู่ใหม่';
    }
}

// โหลดข้อมูลลูกค้าเริ่มต้น
const loadInitialCustomers = async () => {
    try {
        isSearchingCustomer.value = true;
        const data = await CustomerService.getCustomers('', 50);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;

            if (selectedCustomerCode.value && selectedCustomerCode.value.trim() !== '') {
                const matchedCustomer = data.find((cust) => cust.code === selectedCustomerCode.value);
                if (matchedCustomer) {
                    selectedCustomer.value = matchedCustomer;
                    formData.value.customerCode = matchedCustomer.code;
                } else {
                    await searchCustomerByCode(selectedCustomerCode.value);
                }
            }
        } else {
            customerOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า:', error);
        customerOptions.value = [];
    } finally {
        isSearchingCustomer.value = false;
    }
};

// ค้นหาลูกค้าด้วยรหัส
const searchCustomerByCode = async (code) => {
    if (!code) return;

    try {
        isSearchingCustomer.value = true;
        const data = await CustomerService.getCustomers(code, 10);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
            const customer = data.find((cust) => cust.code === code);
            if (customer) {
                selectedCustomer.value = customer;
                formData.value.customerCode = customer.code;
            }
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาลูกค้าด้วยรหัส:', error);
    } finally {
        isSearchingCustomer.value = false;
    }
};

// ค้นหาลูกค้า
const filterCustomers = async (event) => {
    try {
        isSearchingCustomer.value = true;
        const searchTerm = event.value || '';

        if (searchTerm.trim().length < 2) {
            await loadInitialCustomers();
            return;
        }

        const data = await CustomerService.getCustomers(searchTerm, 100);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
        } else {
            customerOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาลูกค้า:', error);
        customerOptions.value = [];
    } finally {
        isSearchingCustomer.value = false;
    }
};

// เมื่อมีการเลือกลูกค้า
const onCustomerSelect = (customer) => {
    if (customer) {
        formData.value.customerCode = customer.code;
        localStorage.setItem('_userCode', customer.code);
        localStorage.setItem('_userData', JSON.stringify(customer));

        formData.value.deliveryAddress = customer.address || '';
        formData.value.deliveryTelephone = customer.telephone || '';
    } else {
        formData.value.customerCode = '';
        localStorage.removeItem('_userCode');
        localStorage.removeItem('_userData');

        formData.value.deliveryAddress = '';
        formData.value.deliveryTelephone = '';
    }
};

// โหลดข้อมูลเงินล่วงหน้า
const loadAdvancePayments = async (custCode) => {
    if (!custCode) return;

    try {
        isLoadingAdvancePayments.value = true;
        const response = await DocHistoryService.getAdvancePayments(custCode);

        if (response && response.data && response.data.data) {
            // Map API response to the format we need
            advancePayments.value = response.data.data.map((item) => ({
                docno: item.doc_no || item.docno,
                balance_amount: item.balance_amount || '0'
            }));
        } else {
            advancePayments.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลเงินล่วงหน้า:', error);
        advancePayments.value = [];
    } finally {
        isLoadingAdvancePayments.value = false;
    }
};

// Checkout process
async function handleCheckout() {
    // Reset error message
    errorMessage.value = '';

    // เพิ่มการป้องกันการกดซ้ำ
    if (isSubmitting.value) {
        return;
    }

    isSubmitting.value = true;

    // Validate form first - BEFORE showing terms dialog
    let isValid = true;
    let validationMessage = '';

    // Check if customer code is required (for employee users)
    if (props.userType === 'employee' && !formData.value.customerCode?.trim()) {
        isValid = false;
        validationMessage = 'กรุณาเลือกลูกค้า';
    }

    // Check delivery information if delivery method is selected
    if (formData.value.deliveryMethod === 'delivery') {
        if (!formData.value.deliveryAddress?.trim()) {
            isValid = false;
            validationMessage = 'กรุณากรอกที่อยู่สำหรับจัดส่ง';
        } else if (!formData.value.deliveryTelephone?.trim()) {
            isValid = false;
            validationMessage = 'กรุณากรอกเบอร์โทรศัพท์สำหรับติดต่อ';
        }
    }

    // If validation fails, show error message and exit
    if (!isValid) {
        errorMessage.value = validationMessage;
        isSubmitting.value = false; // รีเซ็ตตัวแปร isSubmitting ถ้าไม่ผ่าน validation
        return;
    }

    // Form is valid, now check for terms acceptance
    if (!termsAccepted.value) {
        termsDialog.value = true;
        isSubmitting.value = false; // รีเซ็ตตัวแปร isSubmitting ถ้าต้องแสดง dialog
        return;
    }

    // ถ้าผ่านการ validate และยอมรับเงื่อนไขแล้ว ดำเนินการต่อ
    await proceedCheckout();
}

function confirmTerms() {
    termsAccepted.value = true;
    termsDialog.value = false;
    // ทำการสั่งซื้อต่อทันที
    isSubmitting.value = true; // ตั้งค่าเป็น true เพื่อป้องกันการกดซ้ำ
    proceedCheckout();
}

function cancelTerms() {
    termsAccepted.value = false;
    termsDialog.value = false;
    isSubmitting.value = false; // รีเซ็ตตัวแปร isSubmitting เมื่อยกเลิก
}

async function proceedCheckout() {
    try {
        isCheckingOut.value = true;

        // อัพเดตข้อมูลก่อนส่ง
        // Update telephone based on send_type
        if (formData.value.send_type === '0') {
            // รับที่ร้าน - ใช้เบอร์โทรของผู้ใช้
            formData.value.telephone = props.userData.telephone || '';
        } else {
            // จัดส่ง - ใช้เบอร์โทรจากฟอร์ม
            formData.value.telephone = formData.value.deliveryTelephone;

            // อัพเดต address และ address_name ตามที่ผู้ใช้เลือก
            if (addressType.value === 'current') {
                formData.value.address = currentAddress.value;
                formData.value.address_name = 'ใช้ที่อยู่ปัจจุบัน';
            } else {
                formData.value.address = customAddress.value;
                formData.value.address_name = 'ระบุที่อยู่ใหม่';
            }
        }

        // Make sure all fields for new requirements are explicitly set
        const dataToSend = {
            ...formData.value,
            // Ensure all required fields are explicitly set
            send_type: formData.value.send_type,
            address: formData.value.address,
            address_name: formData.value.address_name,
            telephone: formData.value.telephone,
            // เพิ่มข้อมูลสินค้าพร้อม tax_type
            items: props.cartItems.map((item) => {
                const taxType = getTaxType(item.item_code);
                console.log(`StepConfirmation - สินค้า ${item.item_code}: tax_type = "${taxType}"`);

                return {
                    ...item,
                    tax_type: taxType // เพิ่ม tax_type สำหรับแต่ละสินค้า
                };
            })
        };

        console.log('Step confirmation sending data:', dataToSend);
        console.log(
            'Items with tax_type:',
            dataToSend.items.map((item) => ({
                item_code: item.item_code,
                tax_type: item.tax_type,
                price: item.price,
                qty: item.qty
            }))
        );

        // Process checkout using the parent component's method
        const success = await emit('process-checkout', dataToSend);

        if (!success) {
            isCheckingOut.value = false;
            isSubmitting.value = false; // รีเซ็ตตัวแปรเมื่อไม่สำเร็จ
        }
    } catch (error) {
        console.error('Checkout error:', error);
        errorMessage.value = 'เกิดข้อผิดพลาดในการสั่งซื้อ โปรดลองใหม่อีกครั้ง';
        isCheckingOut.value = false;
        isSubmitting.value = false; // รีเซ็ตตัวแปรเมื่อเกิดข้อผิดพลาด
    }
}

// Function to update remark with selected advance payments
function updateRemarkWithAdvancePayments() {
    // Get comma-separated list of selected document numbers
    const selectedDocs = selectedAdvancePayments.value.map((payment) => payment.docno).join(',');

    // Store original remark (user entered text without advance payment info)
    if (!formData.value._originalRemark && !formData.value.remark.includes('รับเงินล่วงหน้า:')) {
        formData.value._originalRemark = formData.value.remark;
    } else if (!formData.value._originalRemark) {
        formData.value._originalRemark = '';
    }

    // Update remark based on selection status
    if (selectedDocs) {
        const advanceInfo = `รับเงินล่วงหน้า: ${selectedDocs} (${selectedAdvancePayments.value.map((payment) => `฿${formatNumber(payment.balance_amount)}`).join(', ')})`;

        // Remove any previous advance payment text before adding new one
        let cleanRemark = formData.value._originalRemark || '';
        cleanRemark = cleanRemark.replace(/รับเงินล่วงหน้า:.*(\n|$)/g, '').trim();

        formData.value.remark = advanceInfo + (cleanRemark ? '\n' + cleanRemark : '');
    } else {
        // No selections - restore original remark without advance payment text
        formData.value.remark = formData.value._originalRemark || '';
    }
}

// Update manual remark (when user types directly)
function updateOriginalRemark(event) {
    // Capture user's manual entry, excluding any advance payment text
    const currentText = event.target.value || '';
    const withoutAdvanceText = currentText.replace(/รับเงินล่วงหน้า:.*(\n|$)/g, '').trim();

    formData.value._originalRemark = withoutAdvanceText;

    // Re-apply the advance payment text if there are selections
    if (selectedAdvancePayments.value.length > 0) {
        updateRemarkWithAdvancePayments();
    }
}

// Utility functions
function formatNumber(value) {
    if (value === undefined || value === null) return '0.00';
    const num = parseFloat(value);
    return !isNaN(num)
        ? num.toLocaleString('th-TH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
          })
        : '0.00';
}

function getProductImage(itemCode) {
    if (!itemCode) {
        return 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
    }
    return ProductService.getProductImageUrl(itemCode);
}

function handleImageError(event) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';
}

// คำนวณยอดรวมโดยใช้ราคายืนยัน
function calculateConfirmedTotal() {
    return props.cartItems.reduce((total, item) => {
        const confirmedPrice = getConfirmedPrice(item.item_code);
        const price = confirmedPrice !== null ? confirmedPrice : item.price;
        return total + price * item.qty;
    }, 0);
}

function getConfirmedPrice(itemCode) {
    const confirmedItem = confirmedItems.value.find((item) => item.item_code === itemCode);
    return confirmedItem ? parseFloat(confirmedItem.price_confirm) : null;
}

// ดึงข้อมูล tax_type ของสินค้า
function getTaxType(itemCode) {
    const confirmedItem = confirmedItems.value.find((item) => item.item_code === itemCode);
    return confirmedItem ? confirmedItem.tax_type : '0'; // default เป็น '0' = มีภาษี
}
</script>

<template>
    <div>
        <h2 class="text-xl font-bold mb-4">ยืนยันการสั่งซื้อ</h2>

        <!-- Order summary -->
        <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">สรุปรายการสั่งซื้อ</h3>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div v-for="(item, index) in cartItems" :key="item.id" :class="['flex items-center gap-3', index !== cartItems.length - 1 ? 'border-b border-gray-200 dark:border-gray-700 pb-3 mb-3' : '']">
                    <!-- Thumbnail -->
                    <div class="w-12 h-12 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                        <img :src="getProductImage(item.item_code)" :alt="item.item_name" class="w-full h-full object-contain" @error="handleImageError" />
                    </div>

                    <!-- Details -->
                    <div class="flex-grow">
                        <div class="font-medium">
                            {{ item.item_name }} <span class="text-sm text-blue-500 dark:text-white">[{{ item.shelf_code }}]</span>
                        </div>
                        <div class="text-sm text-gray-500">{{ item.item_code }}</div>
                    </div>

                    <!-- Qty & Price -->
                    <div class="text-right">
                        <div class="font-medium">
                            <!-- แสดงราคาใหม่จาก price_confirm ถ้ามีความแตกต่าง -->
                            <template v-if="getConfirmedPrice(item.item_code) !== null && getConfirmedPrice(item.item_code) !== item.price">
                                <div class="font-medium text-green-600">฿{{ formatNumber(getConfirmedPrice(item.item_code) * item.qty) }}</div>
                                <div class="text-sm line-through text-gray-500">฿{{ formatNumber(item.price * item.qty) }}</div>
                            </template>
                            <template v-else>
                                <div class="font-medium">฿{{ formatNumber(item.price * item.qty) }}</div>
                            </template>
                        </div>
                        <div class="text-sm text-gray-500">
                            <!-- แสดงจำนวนและราคาต่อหน่วย -->
                            <template v-if="getConfirmedPrice(item.item_code) !== null && getConfirmedPrice(item.item_code) !== item.price">
                                {{ item.qty }} x <span class="text-green-600">฿{{ formatNumber(getConfirmedPrice(item.item_code)) }}</span>
                                <span class="line-through">฿{{ formatNumber(item.price) }}</span>
                            </template>
                            <template v-else> {{ item.qty }} x ฿{{ formatNumber(item.price) }} </template>
                        </div>
                    </div>
                </div>

                <!-- Totals -->
                <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-gray-600 dark:text-gray-400">จำนวนสินค้า:</span>
                        <span>{{ totals.totalItems }} ชิ้น</span>
                    </div>
                    <div class="flex justify-between items-center text-lg font-bold">
                        <span>ยอดรวมทั้งสิ้น:</span>
                        <span class="text-primary">฿{{ formatNumber(calculateConfirmedTotal()) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Customer/Employee information -->
        <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">ข้อมูลการสั่งซื้อ</h3>

            <!-- Customer form -->
            <div v-if="userType === 'customer'" class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <!-- Delivery method selection -->
                <div class="mb-4">
                    <label class="block font-medium mb-2">วิธีการรับสินค้า</label>
                    <div class="flex gap-2">
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'pickup' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'pickup'"
                        >
                            <i class="pi pi-shopping-bag mr-2 text-primary-500"></i>
                            <span>รับที่ร้าน</span>
                        </div>
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'delivery' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'delivery'"
                        >
                            <i class="pi pi-truck mr-2 text-primary-500"></i>
                            <span>จัดส่ง</span>
                        </div>
                    </div>
                </div>

                <!-- Employee code เปลี่ยนเป็นแบบ Select -->
                <div class="mb-4">
                    <label for="employee-code" class="block font-medium mb-2">รหัสพนักงานที่ดูแล (ถ้ามี)</label>
                    <div v-if="isSearchingEmployee && employeeOptions.length === 0" class="flex justify-center py-2">
                        <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
                    </div>
                    <Select
                        v-model="selectedEmployee"
                        :options="employeeOptions"
                        optionLabel="name"
                        placeholder="เลือกพนักงาน"
                        class="w-full"
                        :loading="isSearchingEmployee"
                        filter
                        @filter="filterEmployees"
                        filterPlaceholder="พิมพ์ชื่อหรือรหัสพนักงาน"
                        :virtualScrollerOptions="{ itemSize: 48, lazy: true, delay: 250 }"
                        :showClear="true"
                        @change="onEmployeeSelect($event.value)"
                    >
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex items-center">
                                <i class="pi pi-user mr-2 text-primary"></i>
                                <div>{{ slotProps.value.code ? slotProps.value.code : '' }} {{ slotProps.value.name ? slotProps.value.name : '' }}</div>
                            </div>
                            <span v-else>
                                {{ slotProps.placeholder }}
                            </span>
                        </template>
                        <template #option="slotProps">
                            <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                                <div class="font-bold">{{ slotProps.option.code }}</div>
                                <div>{{ slotProps.option.name }}</div>
                            </div>
                        </template>
                    </Select>
                    <small class="text-color-secondary">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา หรือเลือกจากรายการ</small>
                </div>

                <!-- แทนที่ส่วนของ Delivery information ทั้งหมด -->
                <!-- Delivery information (shown when delivery is selected) -->
                <div v-if="formData.deliveryMethod === 'delivery'">
                    <div class="mb-4">
                        <label class="block font-medium mb-2">เลือกที่อยู่จัดส่ง</label>
                        <div class="flex flex-col gap-3">
                            <!-- ตัวเลือกใช้ที่อยู่ปัจจุบัน (แสดงเฉพาะเมื่อมีที่อยู่) -->
                            <div
                                v-if="currentAddress"
                                :class="['flex items-start p-3 border rounded-lg cursor-pointer', addressType === 'current' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700']"
                                @click="addressType = 'current'"
                            >
                                <RadioButton v-model="addressType" value="current" :binary="false" class="mt-1 mr-2" />
                                <div class="flex-1">
                                    <div class="font-medium mb-1">ใช้ที่อยู่ปัจจุบัน</div>
                                    <div class="text-gray-600 dark:text-gray-400 mb-1 whitespace-pre-line">{{ currentAddress }}</div>
                                    <div class="text-gray-600 dark:text-gray-400">เบอร์โทรศัพท์: {{ currentTelephone || 'ไม่ระบุ' }}</div>
                                </div>
                            </div>

                            <!-- ตัวเลือกระบุที่อยู่เอง -->
                            <div
                                :class="['flex items-start p-3 border rounded-lg cursor-pointer', addressType === 'custom' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700']"
                                @click="addressType = 'custom'"
                            >
                                <RadioButton v-model="addressType" value="custom" :binary="false" class="mt-1 mr-2" />
                                <div class="flex-1">
                                    <div class="font-medium mb-2">ระบุที่อยู่ใหม่</div>

                                    <div class="mb-3">
                                        <label for="custom-address" class="block text-sm mb-1">ที่อยู่จัดส่ง <span class="text-red-500">*</span></label>
                                        <Textarea id="custom-address" v-model="customAddress" rows="3" class="w-full" placeholder="กรอกที่อยู่จัดส่ง" :disabled="addressType !== 'custom'" />
                                    </div>

                                    <div>
                                        <label for="custom-phone" class="block text-sm mb-1">เบอร์โทรศัพท์ <span class="text-red-500">*</span></label>
                                        <InputText id="custom-phone" v-model="customTelephone" class="w-full" placeholder="กรอกเบอร์โทรศัพท์" :disabled="addressType !== 'custom'" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Advance Payment Selection -->
                <div class="mb-4 mt-4">
                    <label for="advance-payment" class="block font-medium mb-2">รับเงินล่วงหน้า</label>
                    <div v-if="isLoadingAdvancePayments" class="flex justify-center py-2">
                        <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
                    </div>
                    <MultiSelect
                        id="advance-payment"
                        v-model="selectedAdvancePayments"
                        :options="advancePayments"
                        optionLabel="docno"
                        placeholder="เลือกเอกสารเงินล่วงหน้า"
                        class="w-full"
                        display="chip"
                        :disabled="isLoadingAdvancePayments || advancePayments.length === 0"
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center">
                                <div>{{ slotProps.option.docno }} - ฿{{ formatNumber(slotProps.option.balance_amount) }}</div>
                            </div>
                        </template>
                        <template #chip="slotProps">
                            <div>{{ slotProps.value.docno }} (฿{{ formatNumber(slotProps.value.balance_amount) }})</div>
                        </template>
                    </MultiSelect>
                    <small v-if="advancePayments.length === 0 && !isLoadingAdvancePayments" class="text-gray-500 dark:text-gray-400">ไม่พบรายการเงินล่วงหน้า</small>
                    <small v-else class="text-gray-500 dark:text-gray-400">เลือกเอกสารเงินล่วงหน้าที่ต้องการใช้</small>
                </div>

                <div class="mb-4 mt-4">
                    <label for="order-remark" class="block font-medium mb-2">หมายเหตุ</label>
                    <Textarea id="order-remark" v-model="formData.remark" rows="2" class="w-full" placeholder="ระบุหมายเหตุหรือข้อความอื่นๆ เช่น ช่วงเวลาที่สะดวกให้จัดส่ง คำแนะนำสำหรับพนักงานจัดส่ง" @input="updateOriginalRemark" />
                    <small class="text-gray-500 dark:text-gray-400">เช่น เวลาที่สะดวกให้จัดส่ง, คำแนะนำพิเศษ ฯลฯ</small>
                </div>
            </div>

            <!-- Employee form -->
            <div v-else-if="userType === 'employee'" class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <!-- Delivery method selection -->
                <div class="mb-4">
                    <label class="block font-medium mb-2">วิธีการรับสินค้า</label>
                    <div class="flex gap-2">
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'pickup' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'pickup'"
                        >
                            <i class="pi pi-shopping-bag mr-2 text-primary-500"></i>
                            <span>รับที่ร้าน</span>
                        </div>
                        <div
                            :class="['flex items-center p-3 border rounded-lg cursor-pointer flex-1', formData.deliveryMethod === 'delivery' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' : 'border-gray-200 dark:border-gray-700']"
                            @click="formData.deliveryMethod = 'delivery'"
                        >
                            <i class="pi pi-truck mr-2 text-primary-500"></i>
                            <span>จัดส่ง</span>
                        </div>
                    </div>
                </div>
                <div class="mb-4">
                    <label for="customer-code" class="block font-medium mb-2">รหัสลูกค้า <span class="text-red-500">*</span></label>
                    <div v-if="isSearchingCustomer && customerOptions.length === 0" class="flex justify-center py-2">
                        <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
                    </div>
                    <Message severity="info" icon="pi pi-user">{{ selectedCustomerCode }}</Message>

                    <!-- <Select
                        v-model="selectedCustomer"
                        :options="customerOptions"
                        optionLabel="name"
                        placeholder="เลือกลูกค้า"
                        class="w-full"
                        :loading="isSearchingCustomer"
                        filter
                        @filter="filterCustomers"
                        filterPlaceholder="พิมพ์ชื่อหรือรหัสลูกค้า"
                        :virtualScrollerOptions="{ itemSize: 48, lazy: true, delay: 250 }"
                        :showClear="true"
                        @change="onCustomerSelect($event.value)"
                    >
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex items-center">
                                <i class="pi pi-user mr-2 text-primary"></i>
                                <div>{{ slotProps.value.code ? slotProps.value.code : '' }} {{ slotProps.value.name ? slotProps.value.name : '' }}</div>
                            </div>
                            <span v-else>
                                {{ slotProps.placeholder }}
                            </span>
                        </template>
                        <template #option="slotProps">
                            <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                                <div class="font-bold">{{ slotProps.option.code }}</div>
                                <div>{{ slotProps.option.name }}</div>
                            </div>
                        </template>
                    </Select>
                    <small class="text-color-secondary">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา หรือเลือกจากรายการ</small> -->
                </div>
                <!-- Delivery information (shown when delivery is selected) -->
                <div v-if="formData.deliveryMethod === 'delivery'">
                    <div class="mb-4">
                        <label for="delivery-address" class="block font-medium mb-2">ที่อยู่จัดส่ง <span class="text-red-500">*</span></label>
                        <Textarea id="delivery-address" v-model="formData.deliveryAddress" rows="3" class="w-full" placeholder="กรอกที่อยู่จัดส่ง" />
                    </div>

                    <div class="mb-4">
                        <label for="delivery-phone" class="block font-medium mb-2">เบอร์โทรศัพท์ <span class="text-red-500">*</span></label>
                        <InputText id="delivery-phone" v-model="formData.deliveryTelephone" class="w-full" placeholder="กรอกเบอร์โทรศัพท์" />
                    </div>
                </div>

                <!-- Advance Payment Selection for employee -->
                <div class="mb-4 mt-4">
                    <label for="advance-payment-emp" class="block font-medium mb-2">รับเงินล่วงหน้า</label>
                    <div v-if="isLoadingAdvancePayments" class="flex justify-center py-2">
                        <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
                    </div>
                    <MultiSelect
                        id="advance-payment-emp"
                        v-model="selectedAdvancePayments"
                        :options="advancePayments"
                        optionLabel="docno"
                        placeholder="เลือกเอกสารเงินล่วงหน้า"
                        class="w-full"
                        display="chip"
                        :disabled="isLoadingAdvancePayments || advancePayments.length === 0"
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center">
                                <div>{{ slotProps.option.docno }} - ฿{{ formatNumber(slotProps.option.balance_amount) }}</div>
                            </div>
                        </template>
                        <template #chip="slotProps">
                            <div>{{ slotProps.value.docno }} (฿{{ formatNumber(slotProps.value.balance_amount) }})</div>
                        </template>
                    </MultiSelect>
                    <small v-if="advancePayments.length === 0 && !isLoadingAdvancePayments" class="text-gray-500 dark:text-gray-400">ไม่พบรายการเงินล่วงหน้า</small>
                    <small v-else class="text-gray-500 dark:text-gray-400">เลือกเอกสารเงินล่วงหน้าที่ต้องการใช้</small>
                </div>

                <div class="mb-4 mt-4">
                    <label for="order-remark" class="block font-medium mb-2">หมายเหตุ</label>
                    <Textarea id="order-remark" v-model="formData.remark" rows="2" class="w-full" placeholder="ระบุหมายเหตุหรือข้อความอื่นๆ เช่น ช่วงเวลาที่สะดวกให้จัดส่ง คำแนะนำสำหรับพนักงานจัดส่ง" @input="updateOriginalRemark" />
                    <small class="text-gray-500 dark:text-gray-400">เช่น เวลาที่สะดวกให้จัดส่ง, คำแนะนำพิเศษ ฯลฯ</small>
                </div>
            </div>
        </div>

        <!-- Error message -->
        <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">{{ errorMessage }}</Message>

        <!-- Action buttons -->
        <div class="flex justify-between mt-6">
            <Button label="ย้อนกลับ" icon="pi pi-arrow-left" outlined @click="emit('prev-step')" />
            <Button label="ยืนยันการสั่งซื้อ" icon="pi pi-check" @click="handleCheckout" :loading="isCheckingOut" :disabled="isSubmitting || (userType === 'employee' && !formData.customerCode)" />
        </div>

        <!-- Terms and Conditions Dialog -->
        <Dialog v-model:visible="termsDialog" modal header="เงื่อนไขและข้อตกลง" :style="{ width: '90%', maxWidth: '500px' }" :closeOnEscape="false" :closable="false">
            <div class="p-2">
                <div class="mb-5 text-gray-700">
                    <ol class="list-decimal pl-5 space-y-3">
                        <li>สินค้าที่ได้รับอาจมีการเปลี่ยนแพ็คเกจและปริมาณจากผู้ผลิต</li>
                        <li>ราคาสินค้า จำนวนสต๊อก อาจมีการแสดงผลคลาดเคลื่อน ในสินค้ากลุ่ม น้ำมันพืช กาแฟ น้ำตาล และสินค้าขาดตลาด ทางบริษัทขออนุญาต เปลี่ยนแปลงโดยไม่แจ้งให้ทราบล่วงหน้า</li>
                    </ol>
                </div>

                <div class="flex items-center mb-5">
                    <Checkbox v-model="termsAccepted" :binary="true" inputId="terms" />
                    <label for="terms" class="ml-2 text-gray-700 cursor-pointer">ข้าพเจ้าได้อ่านและยอมรับเงื่อนไขการสั่งซื้อสินค้า</label>
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end">
                    <Button label="ยกเลิก" icon="pi pi-times" outlined @click="cancelTerms()" class="mr-2" />
                    <Button label="ยืนยัน" icon="pi pi-check" @click="confirmTerms()" :disabled="!termsAccepted" />
                </div>
            </template>
        </Dialog>
    </div>
</template>
