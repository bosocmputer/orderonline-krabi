import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

class DocHistoryService {
    // ดึงรายการเอกสาร
    async getDocList(custCode, transFlag = '') {
        return apiClient.get('/getDocList', {
            params: {
                cust_code: custCode,
                trans_flag: transFlag
            }
        });
    }

    // ดึงรายละเอียดเอกสาร
    async getDocDetail(custCode, docNo) {
        return apiClient.get('/getDocDetail', {
            params: {
                cust_code: custCode,
                doc_no: docNo
            }
        });
    }

    // ดึงยอดเงินคงค้าง
    async getTotalBalance(custCode) {
        return apiClient.get('/getTotalBalance', {
            params: {
                cust_code: custCode
            }
        });
    }

    // ดึงรายการเงินล่วงหน้า
    async getAdvancePayments(custCode) {
        return apiClient.get('/getAdvancePayment', {
            params: {
                cust_code: custCode
            }
        });
    }
}

export default new DocHistoryService();
