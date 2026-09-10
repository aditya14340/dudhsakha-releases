import React, { useState } from 'react';
import { Modal, Form, DatePicker, InputNumber, Radio, Input, Button, Space, message } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DifferenceBillModal = ({ isOpen, onClose, onGenerate }) => {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [calcType, setCalcType] = useState('amount'); // 'amount' or 'liter'
    const [mode, setMode] = useState('trial'); // 'trial' or 'posting'

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            onGenerate({ ...values, templateId: 'difference_bill' });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const isIndic = i18n.language === 'mr' || i18n.language === 'hi';

    return (
        <Modal
            title={isIndic ? "फरक बिल तयार करणे" : "Difference Bill Calculation"}
            open={isOpen}
            onCancel={onClose}
            onOk={handleOk}
            okText={isIndic ? "होय (Generate)" : "Generate"}
            cancelText={isIndic ? "नको (Cancel)" : "Cancel"}
            width={600}
        >
            <Form form={form} layout="vertical" initialValues={{
                calcType: 'amount',
                mode: 'trial',
                postingDate: dayjs()
            }}>
                {/* Date Range */}
                <div style={{ border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                        {isIndic ? "बिल दिनांक" : "Bill Date"}
                    </div>
                    <Form.Item name="dateRange" rules={[{ required: true, message: 'Please select date range' }]} style={{ marginTop: -10 }}>
                        <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                {/* Farmer Range */}
                <div style={{ border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                        {isIndic ? "उत्पादक" : "Farmer Code"}
                    </div>
                    <Space style={{ width: '100%', marginTop: -10 }} align="start">
                        <Form.Item name="fromCode" label={isIndic ? "पासून" : "From"} style={{ flex: 1 }}>
                            <Input placeholder="E.g. 1" />
                        </Form.Item>
                        <Form.Item name="toCode" label={isIndic ? "पर्यंत" : "To"} style={{ flex: 1 }}>
                            <Input placeholder="E.g. 100" />
                        </Form.Item>
                    </Space>
                </div>

                {/* Posting Date */}
                <Form.Item name="postingDate" label={isIndic ? "पोस्टिंग दिनांक" : "Posting Date"}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '50%' }} />
                </Form.Item>

                {/* Calculation Type */}
                <div style={{ border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                        {isIndic ? "प्रकार" : "Type"}
                    </div>
                    <Form.Item name="calcType" style={{ marginTop: -10 }}>
                        <Radio.Group onChange={(e) => setCalcType(e.target.value)} value={calcType}>
                            <Radio value="amount">{isIndic ? "रकमेप्रमाणे (Amount Based)" : "Amount Based"}</Radio>
                            <Radio value="liter">{isIndic ? "लिटर प्रमाणे (Liter Based)" : "Liter Based"}</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Space style={{ width: '100%' }}>
                        <Form.Item name="fixedAmount" label={isIndic ? "ठराविक रक्कम" : "Fixed Amount (₹/L)"}>
                            <InputNumber disabled={calcType === 'amount'} style={{ width: 120 }} />
                        </Form.Item>
                        <Form.Item name="percentage" label={isIndic ? "टक्के" : "Percentage (%)"}>
                            <InputNumber disabled={calcType === 'liter'} style={{ width: 120 }} />
                        </Form.Item>
                    </Space>
                </div>

                {/* Trial or Posting */}
                <Form.Item name="mode">
                    <Radio.Group onChange={(e) => setMode(e.target.value)} value={mode}>
                        <Radio value="trial">{isIndic ? "ट्रायल (Trial)" : "Trial"}</Radio>
                        <Radio value="posting">{isIndic ? "पोस्टिंग (Posting)" : "Posting"}</Radio>
                    </Radio.Group>
                </Form.Item>

            </Form>
        </Modal>
    );
};

export default DifferenceBillModal;
