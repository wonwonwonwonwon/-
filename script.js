document.addEventListener('DOMContentLoaded', () => {
    // !!! 중요: README.md 파일을 읽고, 배포된 자신의 Google Apps Script 웹 앱 URL로 변경하세요.
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzjscbyQFNYxSsWrSk_jLm37y04s8iYmCLCcJVrQVvOUqOpYAmF7Yzv2dM5PzKT-RTP/exec'; // <--- 이 URL을 본인의 URL로 변경하세요.

    const recordForm = document.getElementById('record-form');
    const recordsContainer = document.getElementById('records-container');
    const exportButton = document.getElementById('export-excel');
    // 캔버스 ID 변경 (mood-chart -> format-chart)
    const formatChartCanvas = document.getElementById('format-chart');
    let recordsCache = []; // 데이터 캐싱
    let formatChart; // 차트 변수명 변경

    // 페이지 로드 시 날짜 설정 관련 코드 제거 (새 폼에는 날짜 필드 없음)

    // 데이터 로드 및 화면 업데이트
    const loadRecords = async () => {
        try {
            const response = await fetch(WEB_APP_URL, { method: 'GET', redirect: 'follow' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            recordsCache = await response.json();

            // 서버에서 받은 데이터가 배열인지 확인합니다. 배열이 아니면 Apps Script 에러일 가능성이 높습니다.
            if (!Array.isArray(recordsCache)) {
                console.error("Error data received from Google Apps Script:", recordsCache);
                throw new Error('Google Apps Script에서 에러가 발생했습니다. 개발자 도구(F12)의 Console 탭에서 상세 정보를 확인하세요.');
            }
            
            recordsContainer.innerHTML = '<p>데이터를 불러오는 중...</p>';
            // 최신순으로 정렬 (Timestamp는 Google Sheet에서 자동 생성된다고 가정)
            recordsCache.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
            
            recordsContainer.innerHTML = ''; // 로딩 메시지 제거
            // '인생책'을 기재한 응답만 게시판에 표시 (선택 사항)
            recordsCache.filter(r => r.bookTitle && r.bookTitle !== '없음').forEach(addRecordToDOM);
            // 전체 데이터를 차트에 렌더링
            renderFormatChart(); // 함수명 변경

        } catch (error) {
            console.error('Error loading records:', error);
            recordsContainer.innerHTML = `<p style="color: red;">데이터를 불러오는 데 실패했습니다. README.md 파일을 확인하여 설정을 완료했는지 확인하세요.</p>`;
        }
    };

    // DOM에 기록 목록 행 추가 (인생책 게시판용으로 수정)
    const addRecordToDOM = (record) => {
        const row = document.createElement('div');
        row.classList.add('record-row');

        // 새 기획안에 맞게 표시할 데이터로 변경
        // (record.nickname, record.bookTitle, record.bookReason, record.age, record.frequency)
        row.innerHTML = `
            <div class="record-nickname">${record.nickname || '-'}</div>
            <div class="record-book-title" title="${record.bookTitle}">${record.bookTitle || '-'}</div>
            <div class="record-book-reason" title="${record.bookReason}">${record.bookReason || '-'}</div>
            <div class="record-age">${record.age || '-'}</div>
            <div class="record-frequency">${record.frequency || '-'}</div>
        `;
        recordsContainer.appendChild(row);
    };

    // '독서 형식 선호도' 통계 차트 렌더링 (기존 renderMoodChart에서 수정)
    const renderFormatChart = () => {
        // record.Mood 대신 record.format 기준으로 카운트
        const formatCounts = recordsCache.reduce((acc, record) => {
            if (record.format) { // 데이터가 있는 경우에만
                acc[record.format] = (acc[record.format] || 0) + 1;
            }
            return acc;
        }, {});

        const chartData = {
            labels: Object.keys(formatCounts),
            datasets: [{
                label: '독서 형식',
                data: Object.values(formatCounts),
                backgroundColor: ['#FFC107', '#FF7043', '#8BC34A', '#2196F3', '#9C27B0'],
                hoverOffset: 4
            }]
        };

        if (formatChart) {
            formatChart.destroy(); // 기존 차트 파괴
        }

        formatChart = new Chart(formatChartCanvas, {
            type: 'pie', // 기획안에 '원형 차트' 명시됨
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: '독서 형식 선호도' // 차트 제목 변경
                    }
                }
            }
        });
    };

    // 폼 제출 이벤트 처리
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '제출 중...';

        const formData = new FormData(recordForm);
        // 새 폼 필드에 맞게 data 객체 수정
        const data = {
            nickname: formData.get('nickname'),
            age: formData.get('age'),
            frequency: formData.get('frequency'),
            purpose: formData.get('purpose'),
            genre: formData.get('genre'),
            format: formData.get('format'),
            bookTitle: formData.get('bookTitle'),
            bookReason: formData.get('bookReason')
        };

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors', // Apps Script는 no-cors 모드 또는 복잡한 CORS 설정이 필요할 수 있습니다.
                cache: 'no-cache',
                redirect: 'follow',
                body: JSON.stringify(data)
            });

            // no-cors 모드에서는 응답을 직접 읽을 수 없으므로, 성공적으로 전송되었다고 가정합니다.
            alert('성공적으로 제출되었습니다! 감사합니다.');
            recordForm.reset();
            // 날짜 리셋 코드 제거
            loadRecords(); // 데이터 다시 불러오기

        } catch (error) {
            console.error('Error submitting record:', error);
            alert('제출에 실패했습니다. 인터넷 연결을 확인하세요.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '나의 리포트 제출하기';
        }
    });

    // 엑셀 내보내기 이벤트 처리
    exportButton.addEventListener('click', () => {
        if (recordsCache.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        // 데이터 시트 생성
        const worksheet = XLSX.utils.json_to_sheet(recordsCache);
        // 새 워크북 생성
        const workbook = XLSX.utils.book_new();
        // 워크북에 데이터 시트 추가
        XLSX.utils.book_append_sheet(workbook, worksheet, "리딩맵 응답"); // 시트 이름 변경

        // 헤더 스타일링 (선택 사항)
        if (recordsCache.length > 0) {
            const headers = Object.keys(recordsCache[0]);
            const header_styles = { font: { bold: true } };
            for(let i = 0; i < headers.length; i++){
                const cell_ref = XLSX.utils.encode_cell({c:i, r:0});
                if(worksheet[cell_ref]) {
                    worksheet[cell_ref].s = header_styles;
                }
            }
        }

        // 엑셀 파일 내보내기 (파일명 변경)
        XLSX.writeFile(workbook, "reading_map_records.xlsx");
    });

    // 초기 데이터 로드
    loadRecords();
});