<script setup>
import CustomerService from '@/services/CustomerService';
import EmployeeService from '@/services/EmployeeService';
import WarehouseService from '@/services/WarehouseList';
import { useAuthenStore } from '@/stores/authen';
import { useCartStore } from '@/stores/cartStore'; // เพิ่ม import cartStore
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
// const appName = ref(import.meta.env.VITE_APP_NAME);

// Add authentication store
const authenStore = useAuthenStore();
const cartStore = useCartStore(); // เพิ่ม cartStore

const hasSavedCredentials = ref(false);

// Form refs
const username = ref('');
const password = ref('');
const userType = ref('customer'); // Default to customer login
const rememberMe = ref(false);

// Customer search (for employee login)
const showCustomerSearch = ref(false);
const selectedCustomer = ref(null);
const isSearching = ref(false);
const customerOptions = ref([]);

// เพิ่มส่วนสำหรับเลือกพนักงาน (สำหรับลูกค้า)
const showEmployeeSelection = ref(false);
const selectedEmployee = ref(null);
const isSearchingEmployee = ref(false);
const employeeOptions = ref([]);
const skipEmployeeSelection = ref(false);

// เพิ่มส่วนสำหรับเลือกคลัง
const showWarehouseSelection = ref(false);
const selectedWarehouse = ref(null);
const isLoadingWarehouses = ref(false);
const warehouseOptions = ref([]);

// เพิ่มส่วนสำหรับประเภทการขาย
const saleType = ref(1); // ค่าเริ่มต้นเป็นเงินสด (1)

// เพิ่มส่วนสำหรับแสดงหน้าเลือกทั้งหมดรวมกัน
const showSelectionScreen = ref(false);

onMounted(() => {
    authenStore.loginErrorMsg = '';

    // ตรวจสอบว่า localStorage พร้อมใช้งานหรือไม่
    try {
        if (typeof localStorage !== 'undefined') {
            const savedUserType = localStorage.getItem('_savedUserType');
            const savedUsername = localStorage.getItem('_savedUsername');
            const shouldRemember = localStorage.getItem('_rememberMe') === 'true';

            // ตรวจสอบว่ามีข้อมูลที่ถูกจัดเก็บหรือไม่
            hasSavedCredentials.value = !!savedUsername;

            // ถ้ามีข้อมูลที่บันทึกไว้ ให้นำมาใส่ในฟอร์ม
            if (savedUserType && savedUsername) {
                userType.value = savedUserType;
                username.value = savedUsername;

                // นำรหัสผ่านมาใส่ถ้า rememberMe เป็น true เท่านั้น
                if (shouldRemember && localStorage.getItem('_savedPassword')) {
                    try {
                        password.value = atob(localStorage.getItem('_savedPassword'));
                        rememberMe.value = true;
                    } catch (e) {
                        console.error('เกิดข้อผิดพลาดในการถอดรหัส:', e);
                        password.value = '';
                    }
                }
            }
        }
    } catch (e) {
        console.error('ไม่สามารถเข้าถึง localStorage ได้:', e);
    }
});

// แก้ไขฟังก์ชัน doLogin
const doLogin = async (e) => {
    if (e) {
        e.preventDefault();
    }

    // เก็บข้อมูล username และ password ที่ผู้ใช้ป้อนไว้ก่อน
    const inputUsername = username.value;
    const inputPassword = password.value;

    // บันทึกข้อมูลถ้า rememberMe เป็น true
    try {
        if (typeof localStorage !== 'undefined') {
            if (rememberMe.value) {
                localStorage.setItem('_savedUserType', userType.value);
                localStorage.setItem('_savedUsername', inputUsername);
                localStorage.setItem('_savedPassword', btoa(inputPassword)); // เข้ารหัสด้วย base64
                localStorage.setItem('_rememberMe', 'true');
                hasSavedCredentials.value = true;
            } else {
                // ลบข้อมูลที่บันทึกไว้ถ้าไม่ต้องการจดจำ
                // แต่ไม่ลบค่า username และ password ในฟอร์มปัจจุบัน
                try {
                    if (typeof localStorage !== 'undefined') {
                        localStorage.removeItem('_savedUserType');
                        localStorage.removeItem('_savedUsername');
                        localStorage.removeItem('_savedPassword');
                        localStorage.removeItem('_rememberMe');
                        hasSavedCredentials.value = false;
                    }
                } catch (e) {
                    console.error('ไม่สามารถลบข้อมูลจาก localStorage ได้:', e);
                }
            }
        }
    } catch (e) {
        console.error('ไม่สามารถบันทึกข้อมูลใน localStorage ได้:', e);
    }

    // ทำการ login โดยใช้ข้อมูลที่เก็บไว้
    if (userType.value === 'customer') {
        // Login as customer
        const success = await authenStore.loginCustomer(inputUsername, inputPassword);

        // ตรวจสอบว่า login สำเร็จหรือไม่
        if (success && authenStore.isAuthenticated && authenStore.isCustomer) {
            try {
                // โหลดรายการคลังและพนักงาน
                await Promise.all([loadWarehouses(), loadEmployees()]);
                showSelectionScreen.value = true;
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
                // กรณีเกิดข้อผิดพลาด ให้ข้ามไปหน้าหลักเลย
                router.push('/');
            }
        }
    } else {
        // Login as employee
        const success = await authenStore.loginEmployee(inputUsername, inputPassword);

        // Check if login was successful for employee
        if (success && authenStore.isAuthenticated && authenStore.isEmployee) {
            try {
                // โหลดรายการคลังและลูกค้า
                await Promise.all([loadWarehouses(), loadCustomers()]);
                showSelectionScreen.value = true;
            } catch (error) {
                console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
                // กรณีเกิดข้อผิดพลาด ให้ข้ามไปหน้าหลักเลย
                router.push('/');
            }
        }
    }
};

// ฟังก์ชันโหลดรายการคลัง
const loadWarehouses = async () => {
    try {
        isLoadingWarehouses.value = true;
        const response = await WarehouseService.getWarehouseList();

        if (response && response.success && Array.isArray(response.data)) {
            warehouseOptions.value = response.data;
            console.log('จำนวนคลังที่โหลดได้:', warehouseOptions.value.length);
        } else {
            console.warn('ไม่พบข้อมูลคลัง');
            warehouseOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลคลัง:', error);
        warehouseOptions.value = [];
        throw error;
    } finally {
        isLoadingWarehouses.value = false;
    }
};

// ฟังก์ชันโหลดรายการพนักงาน
const loadEmployees = async () => {
    try {
        isSearchingEmployee.value = true;
        const data = await EmployeeService.getEmployees('', 50);

        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;
            console.log('จำนวนพนักงานที่โหลดได้:', employeeOptions.value.length);
        } else {
            console.warn('ไม่พบข้อมูลพนักงาน');
            employeeOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน:', error);
        employeeOptions.value = [];
        throw error;
    } finally {
        isSearchingEmployee.value = false;
    }
};

// ฟังก์ชันโหลดรายการลูกค้า
const loadCustomers = async () => {
    try {
        isSearching.value = true;
        const data = await CustomerService.getCustomers('', 50);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
            console.log('จำนวนลูกค้าที่โหลดได้:', customerOptions.value.length);
        } else {
            console.warn('ไม่พบข้อมูลลูกค้า');
            customerOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า:', error);
        customerOptions.value = [];
        throw error;
    } finally {
        isSearching.value = false;
    }
};

// ฟังก์ชันยืนยันการเลือกทั้งหมด
const confirmAllSelections = async () => {
    // ตรวจสอบว่าเลือกคลังแล้วหรือยัง (บังคับให้เลือก)
    if (!selectedWarehouse.value) {
        alert('กรุณาเลือกคลังก่อนดำเนินการต่อ');
        return;
    }

    // บันทึกข้อมูลคลังที่เลือกลง localStorage
    localStorage.setItem('_selectedWarehouse', JSON.stringify(selectedWarehouse.value));
    localStorage.setItem('_warehouseCode', selectedWarehouse.value.code);
    localStorage.setItem('_warehouseName', selectedWarehouse.value.name);

    // บันทึกประเภทการขาย
    localStorage.setItem('_saleType', saleType.value.toString());
    localStorage.setItem('_saleTypeName', saleType.value === 1 ? 'เงินสด' : 'เงินเชื่อ');

    // บันทึกข้อมูลพนักงานถ้าเลือก (สำหรับลูกค้า)
    if (authenStore.isCustomer && selectedEmployee.value) {
        localStorage.setItem('_empCode', selectedEmployee.value.code);
        localStorage.setItem('_empData', JSON.stringify(selectedEmployee.value));
    } else if (authenStore.isCustomer) {
        // ล้างข้อมูลพนักงานถ้าไม่เลือก
        localStorage.removeItem('_empCode');
        localStorage.removeItem('_empData');
    }

    console.log('บันทึกข้อมูลเรียบร้อย:', {
        warehouse: selectedWarehouse.value,
        employee: selectedEmployee.value,
        saleType: saleType.value
    });

    // โหลดข้อมูลตะกร้าสินค้าพร้อมส่ง warehouse code
    try {
        if (authenStore.isCustomer && authenStore.userCode) {
            console.log('Loading cart items with warehouse code:', selectedWarehouse.value.code);
            await cartStore.loadCartItemsForCustomer(authenStore.userCode, selectedWarehouse.value.code);
            console.log('Cart items loaded successfully with warehouse:', cartStore.cartItems.length, 'items');
        }
    } catch (error) {
        console.error('Error loading cart items with warehouse code:', error);
    }

    // ปิดหน้าเลือกและดำเนินการต่อ
    showSelectionScreen.value = false;

    // ตรวจสอบว่าเป็นลูกค้าหรือพนักงาน
    if (authenStore.isCustomer) {
        // สำหรับลูกค้า ไปหน้าหลักเลย
        router.push('/');
    } else if (authenStore.isEmployee) {
        // สำหรับพนักงาน ให้เลือกลูกค้าต่อ
        await proceedToCustomerSelection();
    }
};

// ฟังก์ชันข้ามการเลือกคลัง
const skipWarehouseSelection = async () => {
    // ลบข้อมูลคลังที่เคยเลือกไว้ (ถ้ามี)
    localStorage.removeItem('_selectedWarehouse');
    localStorage.removeItem('_warehouseCode');
    localStorage.removeItem('_warehouseName');

    // ปิดหน้าเลือกคลังและไปขั้นตอนถัดไป
    showWarehouseSelection.value = false;

    // ตรวจสอบว่าเป็นลูกค้าหรือพนักงาน
    if (authenStore.isCustomer) {
        // สำหรับลูกค้า ให้ไปขั้นตอนเลือกพนักงาน
        await proceedToEmployeeSelection();
    } else if (authenStore.isEmployee) {
        // สำหรับพนักงาน ให้ไปขั้นตอนเลือกลูกค้า
        await proceedToCustomerSelection();
    }
};

// ฟังก์ชันไปขั้นตอนเลือกพนักงาน (สำหรับลูกค้า)
const proceedToEmployeeSelection = async () => {
    try {
        // โหลดข้อมูลพนักงานเริ่มต้นเพื่อตรวจสอบ
        isSearchingEmployee.value = true;
        const data = await EmployeeService.getEmployees('', 50);

        // ถ้ามีพนักงานให้เลือก ให้แสดงหน้าเลือกพนักงาน
        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;
            showEmployeeSelection.value = true;
        } else {
            // ถ้าไม่มีพนักงาน ให้ข้ามไปหน้าหลักเลย
            console.warn('ไม่พบข้อมูลพนักงาน ข้ามการเลือกพนักงาน');
            router.push('/');
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน:', error);
        // กรณีเกิดข้อผิดพลาด ให้ข้ามไปหน้าหลักเลย
        router.push('/');
    } finally {
        isSearchingEmployee.value = false;
    }
};

// ฟังก์ชันไปขั้นตอนเลือกลูกค้า (สำหรับพนักงาน)
const proceedToCustomerSelection = async () => {
    try {
        // โหลดข้อมูลลูกค้าเริ่มต้นเพื่อตรวจสอบ
        isSearching.value = true;
        const data = await CustomerService.getCustomers('', 50);

        // ถ้ามีลูกค้าให้เลือก ให้แสดงหน้าเลือกลูกค้า
        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
            showCustomerSearch.value = true;
        } else {
            // ถ้าไม่มีลูกค้า ให้ข้ามไปหน้าหลักเลย
            console.warn('ไม่พบข้อมูลลูกค้า ข้ามการเลือกลูกค้า');
            router.push('/');
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า:', error);
        // กรณีเกิดข้อผิดพลาด ให้ข้ามไปหน้าหลักเลย
        router.push('/');
    } finally {
        isSearching.value = false;
    }
};

// แก้ไขฟังก์ชัน clearSavedCredentials แยกต่างหาก
const clearSavedCredentials = () => {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('_savedUserType');
            localStorage.removeItem('_savedUsername');
            localStorage.removeItem('_savedPassword');
            localStorage.removeItem('_rememberMe');
            hasSavedCredentials.value = false;
        }
    } catch (e) {
        console.error('ไม่สามารถลบข้อมูลจาก localStorage ได้:', e);
    }
};
// Switch user type
const switchUserType = (type) => {
    // ถ้ามีการเปลี่ยนประเภทผู้ใช้ ให้ล้างฟอร์ม
    if (type !== userType.value) {
        userType.value = type;
        // Clear form when switching
        username.value = '';
        password.value = '';
        authenStore.loginErrorMsg = '';
        showCustomerSearch.value = false;
        showEmployeeSelection.value = false;
        showWarehouseSelection.value = false;
        showSelectionScreen.value = false;
        selectedCustomer.value = null;
        selectedEmployee.value = null;
        selectedWarehouse.value = null;
        saleType.value = 1; // รีเซ็ตเป็นเงินสด
        skipEmployeeSelection.value = false;

        // ถ้ามีการเปลี่ยนประเภทผู้ใช้ ให้ลบข้อมูลที่จดจำไว้
        if (rememberMe.value) {
            clearSavedCredentials();
        }
    }
};

// Confirm customer selection and proceed
const confirmCustomerSelection = async () => {
    if (!selectedCustomer.value) return;

    const customer = selectedCustomer.value;

    // Store customer data in localStorage แยกจากข้อมูลพนักงาน
    localStorage.setItem('_userCode', customer.code);
    localStorage.setItem(
        '_userData',
        JSON.stringify({
            user_code: customer.code,
            user_name: customer.name,
            address: customer.address,
            tax_id: customer.tax_id,
            telephone: customer.telephone
        })
    );

    // อัพเดตค่าใน store ด้วย
    authenStore.userData = {
        user_code: customer.code,
        user_name: customer.name,
        address: customer.address,
        tax_id: customer.tax_id
    };
    authenStore.userCode = customer.code;

    // โหลดข้อมูลตะกร้าสินค้าของลูกค้าทันทีพร้อมส่ง warehouse code
    try {
        const warehouseCode = localStorage.getItem('_warehouseCode');
        console.log('Loading cart items for customer:', customer.code, 'with warehouse:', warehouseCode);
        console.log('warehouseCode type:', typeof warehouseCode, 'value:', warehouseCode);
        await cartStore.loadCartItemsForCustomer(customer.code, warehouseCode);
        console.log('Cart items loaded successfully:', cartStore.cartItems.length, 'items');
    } catch (error) {
        console.error('Error loading cart items for customer:', error);
    }

    // Close the search panel and navigate to home
    showCustomerSearch.value = false;
    router.push('/');
};

// เพิ่มฟังก์ชันยืนยันการเลือกพนักงานและดำเนินการต่อ
const confirmEmployeeSelection = () => {
    // บันทึกข้อมูลพนักงานที่เลือก
    if (selectedEmployee.value) {
        // บันทึกรหัสพนักงานที่ดูแลลูกค้านี้
        localStorage.setItem('_empCode', selectedEmployee.value.code);
        localStorage.setItem('_empData', JSON.stringify(selectedEmployee.value));
    }

    // ปิดหน้าค้นหาและนำทางไปหน้าหลัก
    showEmployeeSelection.value = false;
    router.push('/');
};

// เพิ่มฟังก์ชันข้ามการเลือกพนักงาน
const skipEmployeeSelectionFn = () => {
    // ล้างข้อมูลพนักงานที่เคยเลือกไว้ (ถ้ามี)
    localStorage.removeItem('_empCode');
    localStorage.removeItem('_empData');

    // ปิดหน้าค้นหาและนำทางไปหน้าหลัก
    showEmployeeSelection.value = false;
    router.push('/');
};

// Handle customer filtering in Select
const filterCustomers = async (event) => {
    try {
        isSearching.value = true;

        // ดึงค่าที่ผู้ใช้พิมพ์ค้นหาจาก event
        const searchTerm = event.value || '';

        // ถ้าข้อความค้นหาสั้นเกินไป ให้โหลดข้อมูลเริ่มต้น
        if (searchTerm.trim().length < 2) {
            const data = await CustomerService.getCustomers('', 50);
            if (Array.isArray(data) && data.length > 0) {
                customerOptions.value = data;
            } else {
                customerOptions.value = [];
            }
            return;
        }

        // เพิ่มการจำกัดจำนวนผลลัพธ์ที่จะแสดง
        const data = await CustomerService.getCustomers(searchTerm, 100);
        console.log('ผลการค้นหาลูกค้า (จำนวน):', data ? data.length : 0);

        if (Array.isArray(data) && data.length > 0) {
            customerOptions.value = data;
            console.log('จำนวนลูกค้าที่ค้นพบ:', customerOptions.value.length);
        } else {
            console.warn('ไม่พบลูกค้าที่ตรงกับคำค้นหา');
            customerOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาลูกค้า:', error);
        customerOptions.value = [];
    } finally {
        isSearching.value = false;
    }
};

// เพิ่มฟังก์ชันค้นหาพนักงาน
const filterEmployees = async (event) => {
    try {
        isSearchingEmployee.value = true;

        // ดึงค่าที่ผู้ใช้พิมพ์ค้นหาจาก event
        const searchTerm = event.value || '';

        // ถ้าข้อความค้นหาสั้นเกินไป ให้โหลดข้อมูลเริ่มต้น
        if (searchTerm.trim().length < 2) {
            const data = await EmployeeService.getEmployees('', 50);
            if (Array.isArray(data) && data.length > 0) {
                employeeOptions.value = data;
            } else {
                employeeOptions.value = [];
            }
            return;
        }

        // เพิ่มการจำกัดจำนวนผลลัพธ์ที่จะแสดง
        const data = await EmployeeService.getEmployees(searchTerm, 100);
        console.log('ผลการค้นหาพนักงาน (จำนวน):', data ? data.length : 0);

        if (Array.isArray(data) && data.length > 0) {
            employeeOptions.value = data;
            console.log('จำนวนพนักงานที่ค้นพบ:', employeeOptions.value.length);
        } else {
            console.warn('ไม่พบพนักงานที่ตรงกับคำค้นหา');
            employeeOptions.value = [];
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการค้นหาพนักงาน:', error);
        employeeOptions.value = [];
    } finally {
        isSearchingEmployee.value = false;
    }
};
// Computed property to determine if the form should be shown
const showLoginForm = computed(() => {
    return !showCustomerSearch.value && !showEmployeeSelection.value && !showWarehouseSelection.value && !showSelectionScreen.value;
});

/// logout function
const logout = () => {
    authenStore.logout();
    showCustomerSearch.value = false;
    showEmployeeSelection.value = false;
    showWarehouseSelection.value = false;
    showSelectionScreen.value = false;
    selectedCustomer.value = null;
    selectedEmployee.value = null;
    selectedWarehouse.value = null;
    saleType.value = 1; // รีเซ็ตเป็นเงินสด

    // ไม่ลบข้อมูลที่จดจำไว้ เพื่อให้สามารถล็อกอินได้ง่ายในครั้งถัดไป
    // เฉพาะดึงข้อมูลที่บันทึกไว้มาใส่ในฟอร์ม
    const savedUserType = localStorage.getItem('_savedUserType');
    const savedUsername = localStorage.getItem('_savedUsername');

    if (savedUserType && savedUsername) {
        userType.value = savedUserType;
        username.value = savedUsername;
        if (localStorage.getItem('_rememberMe') === 'true' && localStorage.getItem('_savedPassword')) {
            password.value = atob(localStorage.getItem('_savedPassword'));
            rememberMe.value = true;
        } else {
            password.value = '';
            rememberMe.value = false;
        }
    } else {
        username.value = '';
        password.value = '';
        rememberMe.value = false;
    }

    authenStore.loginErrorMsg = '';
    skipEmployeeSelection.value = false;
};
</script>
<template>
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <!-- ปรับให้กล่อง login เต็มจอใน sm และ md, แต่ยังคงมีขนาดจำกัดใน lg ขึ้นไป -->
        <div class="flex flex-col items-center justify-center w-full px-2 sm:px-4 md:max-w-lg lg:max-w-lg">
            <div class="w-full" style="border-radius: 36px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-3 sm:py-4 md:py-6 lg:py-10 px-3 sm:px-5 md:px-6 lg:px-8" style="border-radius: 34px">
                    <!-- Logo and header section with improved styling -->
                    <div class="text-center mb-6">
                        <div class="flex justify-center mb-3 sm:mb-4">
                            <img src="../../../assets/logokrabi.png" alt="Wawa 2559" width="120" class="sm:w-150 md:w-180 lg:w-200 rounded-full shadow-md hover:shadow-lg transition-shadow duration-300" />
                        </div>
                        <div class="text-surface-900 dark:text-surface-0 text-2xl sm:text-2xl md:text-2xl font-medium mb-1">
                            <span class="bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-primary-300">Order Yang Tong</span>
                        </div>
                        <!-- <div class="text-surface-600 dark:text-surface-100 text-sm sm:text-2xl md:text-base font-medium mb-1">ส่งฟรี ตั้งแต่ชิ้นแรก จัดส่งภายใน 1 วัน</div> -->
                        <!-- <div class="text-surface-600 dark:text-surface-100 text-sm sm:text-2xl md:text-base font-medium mb-2"><i class="pi pi-phone mr-1"></i> 02-1147931 ต่อ 116</div> -->

                        <div class="p-badge p-component p-badge-info my-2 inline-block">
                            <span v-if="showCustomerSearch" class="text-sm font-medium">กรุณาเลือกลูกค้า</span>
                            <span v-else-if="showEmployeeSelection" class="text-sm font-medium">กรุณาเลือกพนักงานที่ดูแล</span>
                            <span v-else-if="showWarehouseSelection" class="text-sm font-medium">กรุณาเลือกคลัง</span>
                            <span v-else-if="showSelectionScreen" class="text-sm font-medium">กรุณาตั้งค่าการขาย</span>
                            <span v-else class="text-sm font-medium">เข้าสู่ระบบเพื่อดำเนินการต่อ</span>
                        </div>
                    </div>

                    <!-- ส่วนค้นหาลูกค้า (สำหรับพนักงานที่ล็อกอินแล้ว) -->
                    <div v-if="showCustomerSearch" class="customer-search-section">
                        <!-- สถานะกำลังโหลดข้อมูลลูกค้าเริ่มต้น -->
                        <div v-if="isSearching && customerOptions.length === 0" class="flex flex-column align-items-center justify-content-center p-2 sm:p-4 gap-2">
                            <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                        </div>

                        <!-- การค้นหาลูกค้าด้วย Select -->
                        <div class="mb-3 sm:mb-4">
                            <label class="block text-surface-900 dark:text-surface-0 font-medium mb-1 sm:mb-2">ค้นหาลูกค้า</label>

                            <Select
                                v-model="selectedCustomer"
                                :options="customerOptions"
                                optionLabel="name"
                                placeholder="เลือกลูกค้า"
                                class="w-full"
                                :loading="isSearching"
                                filter
                                @filter="filterCustomers"
                                filterPlaceholder="พิมพ์ชื่อหรือรหัสลูกค้า"
                                :virtualScrollerOptions="{ itemSize: 48, lazy: true, delay: 250 }"
                                :showClear="true"
                            >
                                <template #value="slotProps">
                                    <div v-if="slotProps.value" class="flex items-center">
                                        <i class="pi pi-user mr-2 text-primary"></i>
                                        <div>
                                            {{ slotProps.value.code ? slotProps.value.code : '' }}
                                            {{ slotProps.value.name ? slotProps.value.name : '' }}
                                        </div>
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

                        <!-- แสดงข้อมูลลูกค้าเพิ่มเติมและปุ่มยืนยัน -->
                        <div v-if="selectedCustomer" class="mt-3 sm:mt-4">
                            <Card class="border-1 border-primary-200 dark:border-primary-800 shadow-3">
                                <template #header>
                                    <div class="flex align-items-center gap-2 p-2 sm:p-3 bg-primary-50 dark:bg-primary-900">
                                        <i class="pi pi-user-edit text-primary" style="font-size: 1.25rem"></i>
                                        <h3 class="m-0 font-medium text-lg sm:text-xl">ข้อมูลลูกค้า</h3>
                                    </div>
                                </template>
                                <template #content>
                                    <div class="grid">
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">รหัส:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedCustomer.code }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">ชื่อ:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedCustomer.name }}</div>
                                        </div>

                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2" v-if="selectedCustomer.tax_id">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">เลขประจำตัวผู้เสียภาษี:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedCustomer.tax_id }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">ที่อยู่:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedCustomer.address }}</div>
                                        </div>
                                    </div>
                                </template>
                                <template #footer>
                                    <div class="flex flex-column sm:flex-row gap-2 justify-content-between">
                                        <Button icon="pi pi-times" label="ยกเลิก" severity="secondary" outlined class="w-full sm:w-auto" @click="selectedCustomer = null" />
                                        <Button icon="pi pi-check" label="ใช้ลูกค้านี้" severity="success" class="w-full sm:w-auto" @click="confirmCustomerSelection" />
                                    </div>
                                </template>
                            </Card>
                        </div>

                        <!-- ปุ่มล็อกเอาท์ -->
                        <div class="mt-3 mb-3 sm:mt-4 sm:mb-4">
                            <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                        </div>
                    </div>

                    <!-- ส่วนเลือกคลัง -->
                    <div v-if="showWarehouseSelection" class="warehouse-selection-section">
                        <!-- สถานะกำลังโหลดข้อมูลคลัง -->
                        <div v-if="isLoadingWarehouses && warehouseOptions.length === 0" class="flex flex-column align-items-center justify-content-center p-2 sm:p-4 gap-2">
                            <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                        </div>

                        <!-- การเลือกคลังด้วย Select -->
                        <div class="mb-3 sm:mb-4">
                            <label class="block text-surface-900 dark:text-surface-0 font-medium mb-1 sm:mb-2">เลือกคลัง (ไม่บังคับ)</label>

                            <Select v-model="selectedWarehouse" :options="warehouseOptions" optionLabel="name" placeholder="เลือกคลัง" class="w-full" :loading="isLoadingWarehouses" :showClear="true">
                                <template #value="slotProps">
                                    <div v-if="slotProps.value" class="flex items-center">
                                        <i class="pi pi-building mr-2 text-primary"></i>
                                        <div>
                                            {{ slotProps.value.code ? slotProps.value.code : '' }}
                                            {{ slotProps.value.name ? ' - ' + slotProps.value.name : '' }}
                                        </div>
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

                            <small class="text-color-secondary">เลือกคลังที่ต้องการใช้งาน หรือข้ามไปใช้งานโดยไม่เลือกคลัง</small>
                        </div>

                        <!-- แสดงข้อมูลคลังเพิ่มเติมและปุ่มยืนยัน -->
                        <div v-if="selectedWarehouse" class="mt-3 sm:mt-4">
                            <Card class="border-1 border-primary-200 dark:border-primary-800 shadow-3">
                                <template #header>
                                    <div class="flex align-items-center gap-2 p-2 sm:p-3 bg-primary-50 dark:bg-primary-900">
                                        <i class="pi pi-building text-primary" style="font-size: 1.25rem"></i>
                                        <h3 class="m-0 font-medium text-lg sm:text-xl">ข้อมูลคลัง</h3>
                                    </div>
                                </template>
                                <template #content>
                                    <div class="grid">
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">รหัส:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedWarehouse.code }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">ชื่อ:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedWarehouse.name }}</div>
                                        </div>
                                    </div>
                                </template>
                                <template #footer>
                                    <div class="flex flex-column sm:flex-row gap-2 justify-content-between">
                                        <Button icon="pi pi-times" label="ยกเลิก" severity="secondary" outlined class="w-full sm:w-auto" @click="selectedWarehouse = null" />
                                        <Button icon="pi pi-check" label="ใช้คลังนี้" severity="success" class="w-full sm:w-auto" @click="confirmWarehouseSelection" />
                                    </div>
                                </template>
                            </Card>
                        </div>

                        <!-- ปุ่มยืนยันหรือข้าม -->
                        <div class="mt-3 sm:mt-4 flex flex-column sm:flex-row gap-2">
                            <Button label="ข้ามการเลือกคลัง" icon="pi pi-step-forward" severity="success" outlined class="w-full" @click="skipWarehouseSelection" />
                        </div>

                        <!-- ปุ่มล็อกเอาท์ -->
                        <div class="mt-3 mb-3 sm:mt-4 sm:mb-4">
                            <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                        </div>
                    </div>

                    <!-- เพิ่มส่วนค้นหาพนักงาน (สำหรับลูกค้าที่ล็อกอินแล้ว) -->
                    <div v-if="showEmployeeSelection" class="employee-search-section">
                        <!-- สถานะกำลังโหลดข้อมูลพนักงานเริ่มต้น -->
                        <div v-if="isSearchingEmployee && employeeOptions.length === 0" class="flex flex-column align-items-center justify-content-center p-2 sm:p-4 gap-2">
                            <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                        </div>

                        <!-- การค้นหาพนักงานด้วย Select -->
                        <div class="mb-3 sm:mb-4">
                            <label class="block text-surface-900 dark:text-surface-0 font-medium mb-1 sm:mb-2">เลือกพนักงานที่ดูแล (ไม่บังคับ)</label>

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
                            >
                                <template #value="slotProps">
                                    <div v-if="slotProps.value" class="flex items-center">
                                        <i class="pi pi-user mr-2 text-primary"></i>
                                        <div>
                                            {{ slotProps.value.code ? slotProps.value.code : '' }}
                                            {{ slotProps.value.name ? slotProps.value.name : '' }}
                                        </div>
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

                        <!-- แสดงข้อมูลพนักงานเพิ่มเติมและปุ่มยืนยัน -->
                        <div v-if="selectedEmployee" class="mt-3 sm:mt-4">
                            <Card class="border-1 border-primary-200 dark:border-primary-800 shadow-3">
                                <template #header>
                                    <div class="flex align-items-center gap-2 p-2 sm:p-3 bg-primary-50 dark:bg-primary-900">
                                        <i class="pi pi-id-card text-primary" style="font-size: 1.25rem"></i>
                                        <h3 class="m-0 font-medium text-lg sm:text-xl">ข้อมูลพนักงาน</h3>
                                    </div>
                                </template>
                                <template #content>
                                    <div class="grid">
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">รหัส:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedEmployee.code }}</div>
                                        </div>
                                        <div class="col-12 border-bottom-1 border-primary-100 dark:border-primary-900 py-1 sm:py-2">
                                            <div class="font-bold text-base sm:text-lg text-primary mb-1 sm:mb-2">ชื่อ:</div>
                                            <div class="pl-2 sm:pl-3">{{ selectedEmployee.name }}</div>
                                        </div>
                                    </div>
                                </template>
                                <template #footer>
                                    <div class="flex flex-column sm:flex-row gap-2 justify-content-between">
                                        <Button icon="pi pi-times" label="ยกเลิก" severity="secondary" outlined class="w-full sm:w-auto" @click="selectedEmployee = null" />
                                        <Button icon="pi pi-check" label="ใช้พนักงานนี้" severity="success" class="w-full sm:w-auto" @click="confirmEmployeeSelection" />
                                    </div>
                                </template>
                            </Card>
                        </div>

                        <!-- ปุ่มยืนยันหรือข้าม -->
                        <div class="mt-3 sm:mt-4 flex flex-column sm:flex-row gap-2">
                            <Button label="ข้ามการเลือกพนักงาน" icon="pi pi-step-forward" severity="success" outlined class="w-full" @click="skipEmployeeSelectionFn" />
                        </div>

                        <!-- ปุ่มล็อกเอาท์ -->
                        <div class="mt-3 mb-3 sm:mt-4 sm:mb-4">
                            <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                        </div>
                    </div>

                    <!-- ส่วนตั้งค่าการขาย (แสดงหลัง login สำเร็จ) -->
                    <div v-if="showSelectionScreen" class="selection-screen">
                        <!-- สถานะกำลังโหลดข้อมูล -->
                        <div v-if="(isLoadingWarehouses && warehouseOptions.length === 0) || (isSearchingEmployee && employeeOptions.length === 0)" class="flex flex-column align-items-center justify-content-center p-2 sm:p-4 gap-2">
                            <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                            <span class="text-sm">กำลังโหลดข้อมูล...</span>
                        </div>

                        <div v-else>
                            <!-- 1. เลือกพนักงาน (ไม่บังคับ) สำหรับลูกค้า -->
                            <div v-if="authenStore.isCustomer" class="mb-3 sm:mb-4">
                                <label class="block text-surface-900 dark:text-surface-0 font-medium mb-1 sm:mb-2"> <i class="pi pi-user mr-2"></i>เลือกพนักงานที่ดูแล (ไม่บังคับ) </label>
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
                                    :showClear="true"
                                >
                                    <template #value="slotProps">
                                        <div v-if="slotProps.value" class="flex items-center">
                                            <i class="pi pi-user mr-2 text-primary"></i>
                                            <div>{{ slotProps.value.code }} - {{ slotProps.value.name }}</div>
                                        </div>
                                        <span v-else>{{ slotProps.placeholder }}</span>
                                    </template>
                                    <template #option="slotProps">
                                        <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                                            <div class="font-bold">{{ slotProps.option.code }}</div>
                                            <div>{{ slotProps.option.name }}</div>
                                        </div>
                                    </template>
                                </Select>
                                <small class="text-color-secondary">เลือกพนักงานที่ต้องการให้ดูแลการขาย หรือข้ามได้</small>
                            </div>

                            <!-- 2. เลือกคลัง (บังคับ) -->
                            <div class="mb-3 sm:mb-4">
                                <label class="block text-surface-900 dark:text-surface-0 font-medium mb-1 sm:mb-2"> <i class="pi pi-building mr-2"></i>เลือกคลัง <span class="text-red-500">*</span> </label>
                                <Select v-model="selectedWarehouse" :options="warehouseOptions" optionLabel="name" placeholder="เลือกคลัง" class="w-full" :loading="isLoadingWarehouses" :showClear="false">
                                    <template #value="slotProps">
                                        <div v-if="slotProps.value" class="flex items-center">
                                            <i class="pi pi-building mr-2 text-primary"></i>
                                            <div>{{ slotProps.value.code }} - {{ slotProps.value.name }}</div>
                                        </div>
                                        <span v-else>{{ slotProps.placeholder }}</span>
                                    </template>
                                    <template #option="slotProps">
                                        <div class="flex flex-column w-full" v-if="slotProps && slotProps.option">
                                            <div class="font-bold">{{ slotProps.option.code }}</div>
                                            <div>{{ slotProps.option.name }}</div>
                                        </div>
                                    </template>
                                </Select>
                                <small class="text-color-secondary">กรุณาเลือกคลังที่ต้องการใช้งาน (บังคับ)</small>
                            </div>

                            <!-- 3. ประเภทการขาย (RadioButton) -->
                            <div class="mb-4 sm:mb-6">
                                <label class="block text-surface-900 dark:text-surface-0 font-medium mb-2 sm:mb-3"> <i class="pi pi-credit-card mr-2"></i>ประเภทการขาย </label>
                                <div class="flex flex-column gap-2">
                                    <div class="flex align-items-center">
                                        <RadioButton v-model="saleType" inputId="cash" name="saleType" :value="1" />
                                        <label for="cash" class="ml-2 text-surface-900 dark:text-surface-0 font-medium">เงินสด</label>
                                    </div>
                                    <div class="flex align-items-center">
                                        <RadioButton v-model="saleType" inputId="credit" name="saleType" :value="2" />
                                        <label for="credit" class="ml-2 text-surface-900 dark:text-surface-0">เงินเชื่อ</label>
                                    </div>
                                </div>
                            </div>

                            <!-- ปุ่มยืนยัน -->
                            <div class="flex flex-column sm:flex-row gap-2 mb-4">
                                <Button label="ยืนยันการตั้งค่า" icon="pi pi-check" severity="success" class="w-full" @click="confirmAllSelections" :disabled="!selectedWarehouse" />
                            </div>

                            <!-- ปุ่มล็อกเอาท์ -->
                            <div class="mt-2">
                                <Button label="ออกจากระบบ" icon="pi pi-sign-out" severity="secondary" outlined class="w-full" @click="logout()" />
                            </div>
                        </div>
                    </div>

                    <!-- ส่วนฟอร์มล็อกอิน -->
                    <div v-if="showLoginForm">
                        <!-- Toggle buttons for user type -->
                        <div class="login-type-switch mb-3 sm:mb-4 flex justify-center">
                            <SelectButton
                                v-model="userType"
                                :options="[
                                    { label: 'ลูกค้า', value: 'customer' },
                                    { label: 'พนักงาน', value: 'employee' }
                                ]"
                                optionLabel="label"
                                optionValue="value"
                                class="login-type-buttons"
                                @change="switchUserType(userType)"
                            />
                        </div>

                        <form @submit="doLogin">
                            <label :for="userType === 'customer' ? 'customer-code' : 'employee-code'" class="block text-surface-900 dark:text-surface-0 text-base sm:text-lg font-medium mb-1">
                                {{ userType === 'customer' ? 'รหัสลูกค้า' : 'รหัสพนักงาน' }}
                            </label>
                            <InputText
                                :id="userType === 'customer' ? 'customer-code' : 'employee-code'"
                                type="text"
                                :placeholder="userType === 'customer' ? 'รหัสลูกค้า' : 'รหัสพนักงาน'"
                                class="w-full mb-3 sm:mb-4"
                                v-model="username"
                                @keyup.enter="doLogin"
                            />

                            <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-base sm:text-lg mb-1">รหัสผ่าน</label>
                            <Password id="password1" v-model="password" placeholder="รหัสผ่าน" :toggleMask="true" class="mb-3 sm:mb-4" fluid :feedback="false" @keyup.enter="doLogin"></Password>

                            <!-- จำรหัสผ่าน -->
                            <div class="flex items-center justify-between mt-1 mb-4 sm:mb-6 gap-2 sm:gap-8">
                                <div class="flex items-center">
                                    <Checkbox v-model="rememberMe" id="rememberMe" binary class="mr-2"></Checkbox>
                                    <label for="rememberme1" class="text-sm sm:text-base">Remember me</label>
                                </div>
                            </div>

                            <!-- Error message with improved styling -->
                            <transition name="slide-fade">
                                <div v-if="authenStore.loginErrorMsg" class="p-2 sm:p-3 bg-red-100 text-red-700 rounded-lg mb-3 sm:mb-4 dark:bg-red-900 dark:text-red-100 flex items-center">
                                    <i class="pi pi-exclamation-triangle mr-2 text-red-500"></i>
                                    <span class="text-sm sm:text-base">{{ authenStore.loginErrorMsg }}</span>
                                </div>
                            </transition>

                            <!-- Login button with improved styling -->
                            <Button
                                :label="userType === 'customer' ? 'เข้าสู่ระบบลูกค้า' : 'เข้าสู่ระบบพนักงาน'"
                                icon="pi pi-sign-in"
                                class="w-full p-button-md sm:p-button-lg p-button-rounded hover:shadow-lg transition-shadow duration-200"
                                type="submit"
                                :loading="authenStore.loading"
                            >
                            </Button>
                        </form>

                        <!-- LINE contact button with improved spacing -->
                        <!-- <div class="flex justify-center mt-4 sm:mt-5">
                            <a href="https://line.me/R/ti/p/@lvx0392z" target="_blank" rel="noopener noreferrer" class="hover:opacity-80 transition-opacity duration-200">
                                <img src="../../../assets/line.png" alt="LINE Contact" width="100" class="sm:w-120 md:w-140 lg:w-160 rounded-lg shadow hover:shadow-md transition-shadow duration-200" />
                            </a>
                        </div> -->
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
