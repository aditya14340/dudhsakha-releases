import React, { useState } from 'react';
import { Modal, Form, DatePicker, Radio, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const MilkCollectionReportModal = ({ isOpen, onClose, onGenerate }) => {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            onGenerate({ ...values, templateId: 'milk_collection' });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const isIndic = i18n.language === 'mr' || i18n.language === 'hi';

    return (
        <Modal
            title={isIndic ? "दुध खरेदी रिपोर्ट" : "Milk Collection Report"}
            open={isOpen}
            onCancel={onClose}
            onOk={handleOk}
            okText={isIndic ? "होय (Generate)" : "Generate"}
            cancelText={isIndic ? "नको (Cancel)" : "Cancel"}
            width={600}
        >
            <Form form={form} layout="vertical" initialValues={{
                time: 'both',
                animal: 'both',
                reportType: 'detailed'
            }}>
                <div style={{ border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                        {isIndic ? "दुध खरेदी रिपोर्टसाठी दिनांक द्या" : "Date Range for Report"}
                    </div>
                    <Form.Item name="dateRange" rules={[{ required: true, message: 'Please select date range' }]} style={{ marginTop: -10 }}>
                        <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1, border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                            {isIndic ? "वेळ" : "Shift"}
                        </div>
                        <Form.Item name="time" style={{ marginTop: -10, marginBottom: 0 }}>
                            <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Radio value="morning">{isIndic ? "सकाळ" : "Morning"}</Radio>
                                <Radio value="evening">{isIndic ? "संध्याकाळ" : "Evening"}</Radio>
                                <Radio value="both">{isIndic ? "सकाळ व संध्याकाळ" : "Morning & Evening"}</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </div>

                    <div style={{ flex: 1, border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                            {isIndic ? "पशुप्रकार" : "Animal Type"}
                        </div>
                        <Form.Item name="animal" style={{ marginTop: -10, marginBottom: 0 }}>
                            <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Radio value="buffalo">{isIndic ? "म्हैस" : "Buffalo"}</Radio>
                                <Radio value="cow">{isIndic ? "गाय" : "Cow"}</Radio>
                                <Radio value="both">{isIndic ? "गाय व म्हैस" : "Cow & Buffalo"}</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </div>

                    <div style={{ flex: 1, border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                            {isIndic ? "रिपोर्ट प्रकार" : "Report Type"}
                        </div>
                        <Form.Item name="reportType" style={{ marginTop: -10, marginBottom: 0 }}>
                            <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Radio value="detailed">{isIndic ? "सविस्तर" : "Detailed"}</Radio>
                                <Radio value="summary">{isIndic ? "बिलाप्रमाणे" : "Summary"}</Radio>
                                <Radio value="monthly">{isIndic ? "मासिक" : "Monthly"}</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </div>
                </div>
            </Form>
        </Modal>
    );
};

export default MilkCollectionReportModal;
