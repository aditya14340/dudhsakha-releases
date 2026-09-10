// jsPDF imported by callers of this module

export const loadDevanagariFont = async (doc) => {
    try {

        const fontUrl = '/fonts/NotoSansDevanagari-Regular.ttf';

        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error(`Failed to fetch font: ${response.statusText}`);

        const blob = await response.blob();
        const reader = new FileReader();

        return new Promise((resolve, reject) => {
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];

                doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', base64data);

                doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari', 'normal');
                doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoSansDevanagari', 'bold');

                doc.setFont('NotoSansDevanagari');

                console.log('Devanagari font loaded successfully');
                resolve(true);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error loading font:', error);

        return false;
    }
};
