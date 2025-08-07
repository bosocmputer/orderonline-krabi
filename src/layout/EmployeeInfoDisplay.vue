<script setup>
import { onMounted, ref } from 'vue';

// ตัวแปรสถานะ
const isEmployee = ref(false);
const employeeData = ref(null);
const userData = ref(null);
const storeName = ref('');

// ดึงข้อมูลเมื่อคอมโพเนนต์ถูกโหลด
onMounted(() => {
    // ตรวจสอบว่าผู้ใช้เป็นพนักงานหรือไม่
    const userType = localStorage.getItem('_userType');
    isEmployee.value = userType === 'employee';

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
                <span class="welcome-text">สวัสดีพนักงาน</span>
                <span class="user-name">{{ employeeData.user_code }} ~ {{ employeeData.user_name }}</span>
                <span class="welcome-text">คุณกำลังเปิดบิลร้าน </span>
                <span class="user-name">{{ userData.user_code }} ~ {{ userData.user_name }}</span>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
user-info {
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

        .welcome-text {
            font-size: 0.875rem;
            color: var(--text-color-secondary, #6c757d);
        }

        .user-name {
            font-weight: 600;
            color: var(--text-color, #495057);
        }
    }
}
</style>
