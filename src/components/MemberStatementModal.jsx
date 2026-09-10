import React from 'react';
import { Modal, Form, DatePicker, Radio, Input, Space } from 'antd';
import { useTranslation } from 'react-i18next';

const { RangePicker } = DatePicker;

const MemberStatementModal = ({ isOpen, onClose, onGenerate }) => {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            onGenerate({ ...values, templateId: 'member_statement' });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const isIndic = i18n.language === 'mr' || i18n.language === 'hi';

    return (
        <Modal
            title={isIndic ? "Member Statement / वैयक्तिक खतावणी" : "Member Statement"}
            open={isOpen}
            onCancel={onClose}
            onOk={handleOk}
            okText={isIndic ? "होय (Generate)" : "Generate"}
            cancelText={isIndic ? "नको (Cancel)" : "Cancel"}
            width={600}
        >
            <Form form={form} layout="vertical" initialValues={{
                animal: 'both',
                reportType: 'detailed'
            }}>
                <div style={{ border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                        {isIndic ? "उत्पादक माहिती (Farmer Info)" : "Farmer Info"}
                    </div>
                    <Space style={{ width: '100%', marginTop: -10 }} align="start">
                        <Form.Item name="farmerCode" label={isIndic ? "उत्पादक कोड" : "Farmer Code"} rules={[{ required: true, message: 'Please enter code' }]} style={{ flex: 1 }}>
                            <Input placeholder="E.g. 501" />
                        </Form.Item>
                        <Form.Item name="reference" label={isIndic ? "संदर्भ" : "Reference"} style={{ flex: 2 }}>
                            <Input placeholder="Optional reference name" />
                        </Form.Item>
                    </Space>
                </div>

                <div style={{ border: '1px solid #d9d9d9', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ position: 'relative', top: -26, background: '#fff', padding: '0 8px', display: 'inline-block', color: '#666' }}>
                        {isIndic ? "वैयक्तिक खतावणीसाठी दिनांक द्या" : "Date Range"}
                    </div>
                    <Form.Item name="dateRange" rules={[{ required: true, message: 'Please select date range' }]} style={{ marginTop: -10 }}>
                        <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
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
                </div>
            </Form>
        </Modal>
    );
};

export default MemberStatementModal;
