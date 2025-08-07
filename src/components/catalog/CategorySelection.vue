<script setup>
import CategoryService from '@/services/CategoryService';
import Button from 'primevue/button';
import Skeleton from 'primevue/skeleton';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { defineEmits, defineProps, onMounted, ref } from 'vue';

// eslint-disable-next-line no-unused-vars
const props = defineProps({
    selectedCategory: {
        type: String,
        default: 'all'
    }
});

const emit = defineEmits(['select-category']);

// สำหรับเก็บข้อมูลหมวดหมู่
const categories = ref([]);

// สำหรับ Skeleton Loading
const loading = ref(true);

// สำหรับแสดง Toast
const toast = useToast();

// อ้างอิงถึง DOM element ของ category container
const categoryContainer = ref(null);

onMounted(async () => {
    try {
        // โหลดข้อมูลหมวดหมู่จาก CategoryService ที่เชื่อมต่อกับ API
        const response = await CategoryService.getCategories();
        categories.value = response.data;
        loading.value = false;
    } catch (error) {
        console.error('Error loading categories:', error);
        loading.value = false;

        // แสดงข้อความแจ้งเตือน
        const errorMessage = error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลหมวดหมู่';
        toast.add({
            severity: 'error',
            summary: 'เกิดข้อผิดพลาด',
            detail: errorMessage,
            life: 5000
        });
    }
});

// เลือกหมวดหมู่
function selectCategory(categoryCode) {
    emit('select-category', categoryCode);
}

// ฟังก์ชันสำหรับการเลื่อนซ้าย
function scrollLeft() {
    if (categoryContainer.value) {
        categoryContainer.value.scrollBy({ left: -200, behavior: 'smooth' });
    }
}

// ฟังก์ชันสำหรับการเลื่อนขวา
function scrollRight() {
    if (categoryContainer.value) {
        categoryContainer.value.scrollBy({ left: 200, behavior: 'smooth' });
    }
}
</script>

<template>
    <Toast position="top-right" />
    <div class="category-section py-3 px-2">
        <!-- Category Header พร้อมปุ่มเลื่อน -->
        <div class="flex justify-between items-center mb-3 px-2">
            <h3 class="text-lg font-medium m-0"><i class="pi pi-list mr-2"></i>หมวดหมู่สินค้า</h3>

            <!-- ปุ่มเลื่อนสำหรับมือถือ -->
            <div class="md:hidden flex gap-2">
                <Button icon="pi pi-chevron-left" rounded outlined size="small" aria-label="เลื่อนไปทางซ้าย" @click="scrollLeft" />
                <Button icon="pi pi-chevron-right" rounded outlined size="small" aria-label="เลื่อนไปทางขวา" @click="scrollRight" />
            </div>
        </div>

        <!-- Desktop View - แบบแถบปุ่ม -->
        <div class="hidden md:block">
            <!-- Skeleton Loading -->
            <div v-if="loading" class="flex flex-wrap gap-2 px-2">
                <Skeleton v-for="i in 8" :key="i" width="120px" height="36px" class="mb-2" />
            </div>

            <!-- Actual Content -->
            <div v-else class="flex flex-wrap gap-2 px-2">
                <Button
                    v-for="category in categories"
                    :key="category.code"
                    :label="category.name"
                    :outlined="selectedCategory !== category.code"
                    :severity="selectedCategory === category.code ? 'primary' : 'secondary'"
                    size="small"
                    class="category-button"
                    @click="selectCategory(category.code)"
                />
            </div>
        </div>

        <!-- Mobile View - แบบแถบเลื่อนซ้าย-ขวา -->
        <div class="md:hidden relative">
            <!-- Skeleton Loading -->
            <div v-if="loading" class="overflow-x-auto hide-scrollbar">
                <div class="flex gap-2 px-2" style="min-width: max-content">
                    <Skeleton v-for="i in 8" :key="i" width="100px" height="32px" />
                </div>
            </div>

            <!-- Actual Content -->
            <div v-else class="overflow-x-auto hide-scrollbar" ref="categoryContainer">
                <div class="flex gap-2 px-2" style="min-width: max-content">
                    <Button
                        v-for="category in categories"
                        :key="category.code"
                        :label="category.name"
                        :outlined="selectedCategory !== category.code"
                        :severity="selectedCategory === category.code ? 'primary' : 'secondary'"
                        size="small"
                        class="category-button-mobile"
                        @click="selectCategory(category.code)"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.category-section {
    background-color: var(--surface-card);
    padding: 0.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.category-button {
    margin-bottom: 0.5rem;
    text-align: center;
    transition: all 0.2s;
    min-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

.category-button-mobile {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: auto;
}

.hide-scrollbar {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
}

.hide-scrollbar::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
}

/* สไตล์สำหรับปุ่มเลื่อนในส่วนหัว */
.header-scroll-button {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: var(--surface-card);
    border: 1px solid var(--surface-border);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
}

.header-scroll-button:hover {
    background-color: var(--surface-hover);
}

.header-scroll-button:active {
    transform: scale(0.95);
}

@media (max-width: 640px) {
    .category-button {
        font-size: 0.8rem;
        padding: 0.4rem 0.8rem;
    }
}
</style>
