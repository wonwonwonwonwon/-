document.addEventListener('DOMContentLoaded', () => {
    // !!! 중요: README.md 파일을 읽고, 배포된 자신의 Google Apps Script 웹 앱 URL로 변경하세요.
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzjscbyQFNYxSsWrSk_jLm37y04s8iYmCLCcJVrQVvOUqOpYAmF7Yzv2dM5PzKT-RTP/exec'; // <--- 이 URL을 본인의 URL로 변경하세요.

    const recordForm = document.getElementById('record-form');
    const recordsContainer = document.getElementById('records-container');
    const exportButton = document.getElementById('export-excel');
    
    // ▼▼▼ 3개의 차트 캔버스 및 변수 정의 ▼▼▼
    const formatChartCanvas = document.getElementById('format-chart');
    const genreChartCanvas = document.getElementById('genre-chart');
    const ageFrequencyChartCanvas = document.getElementById('age-frequency-chart');
    
    let recordsCache = []; // 데이터 캐싱
    
    let formatChart;
    let genreChart;
    let ageFrequencyChart;
    // ▲▲▲ 3개의 차트 캔버스 및 변수 정의 ▲▲▲

    // 데이터 로드 및 화면 업데이트
    const loadRecords = async () => {
        try {
            const response = await fetch(WEB_APP_URL, { method: 'GET', redirect: 'follow' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            recordsCache = await response.json();

            if (!Array.isArray(recordsCache)) {
                console.error("Error data received from Google Apps Script:", recordsCache);
                throw new Error('Google Apps Script에서 에러가 발생했습니다. 개발자 도구(F12)의 Console 탭에서 상세 정보를 확인하세요.');
            }
            
            recordsContainer.innerHTML = '<p>데이터를 불러오는 중...</p>';
            recordsCache.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
            
            recordsContainer.innerHTML = '';
            recordsCache.filter(r => r.bookTitle && r.bookTitle !== '없음').forEach(addRecordToDOM);
            
            // ▼▼▼ 3개의 차트 모두 렌더링 ▼▼▼
            renderFormatChart();
            renderGenreChart();
            renderAgeFrequencyChart();
            // ▲▲▲ 3개의 차트 모두 렌더링 ▲▲▲

        } catch (error) {
            console.error('Error loading records:', error);
            recordsContainer.innerHTML = `<p style="color: red;">데이터를 불러오는 데 실패했습니다. Google Sheet 헤더와 Apps Script(Code.gs)가 올바르게 수정되었는지 확인하세요.</p>`;
        }
    };

    // DOM에 기록 목록 행 추가 (인생책 게시판용)
    const addRecordToDOM = (record) => {
        const row = document.createElement('div');
        row.classList.add('record-row');
        row.innerHTML = `
            <div class="record-nickname">${record.nickname || '-'}</div>
            <div class="record-book-title">${record.bookTitle || '-'}</div>
            <div class="record-age">${record.age || '-'}</div>
            <div class="record-frequency">${record.frequency || '-'}</div>
        `;
        recordsContainer.appendChild(row);
    };

    // '독서 형식 선호도' 통계 차트 (원형)
    const renderFormatChart = () => {
        const formatCounts = recordsCache.reduce((acc, record) => {
            if (record.format) {
                acc[record.format] = (acc[record.format] || 0) + 1;
            }
            return acc;
        }, {});

        const chartData = {
            labels: Object.keys(formatCounts),
            datasets: [{
                label: '독서 형식',
                data: Object.values(formatCounts),
                backgroundColor: ['#e0c369', '#e97e5e', '#4263dd', '#efd5c0'],
                hoverOffset: 4
            }]
        };

        if (formatChart) formatChart.destroy();
        formatChart = new Chart(formatChartCanvas, {
            type: 'pie',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: false } // HTML에서 h3로 제목 표시
                }
            }
        });
    };

    // ▼▼▼ [신규] 장르별 인기 비율 차트 (원형) ▼▼▼
    const renderGenreChart = () => {
        const genreCounts = recordsCache.reduce((acc, record) => {
            if (record.genre) {
                acc[record.genre] = (acc[record.genre] || 0) + 1;
            }
            return acc;
        }, {});

        const chartData = {
            labels: Object.keys(genreCounts),
            datasets: [{
                label: '장르',
                data: Object.values(genreCounts),
                backgroundColor: [
                    '#e0c369', '#e97e5e', '#4263dd', '#efd5c0', '#e5b4d0', 
                    '#899d35', '#6a77b1', '#96a2a7', '#9bc3d7', '#e79a43',
                    '#ab8839', '#df8691', '#dbde6b', '#795548'
                ],
                hoverOffset: 4
            }]
        };

        if (genreChart) genreChart.destroy();
        genreChart = new Chart(genreChartCanvas, {
            type: 'pie',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: false } // HTML에서 h3로 제목 표시
                }
            }
        });
    };
    // ▲▲▲ [신규] 장르별 인기 비율 차트 ▲▲▲


    // ▼▼▼ [신규] 세대별 독서 빈도 차트 (막대) ▼▼▼
    const renderAgeFrequencyChart = () => {
        const ageGroups = ['10대', '20대', '30대', '40대 이상'];
        const frequencies = ['월 1회 미만', '월 1~2회', '월 3~4회', '주 1회 이상'];
        
        // 1. 데이터 가공
        const dataByAge = recordsCache.reduce((acc, record) => {
            if (record.age && record.frequency) {
                if (!acc[record.age]) acc[record.age] = {};
                acc[record.age][record.frequency] = (acc[record.age][record.frequency] || 0) + 1;
            }
            return acc;
        }, {});

        // 2. Chart.js 데이터셋 형식으로 변환 (그룹 막대 차트용)
        const datasets = frequencies.map(freq => {
            return {
                label: freq,
                data: ageGroups.map(age => dataByAge[age]?.[freq] || 0),
            };
        });

        // 3. 색상 할당
        const colors = ['#e0c369', '#e97e5e', '#4263dd', '#efd5c0'];
        datasets.forEach((ds, index) => {
            ds.backgroundColor = colors[index % colors.length];
        });

        const chartData = {
            labels: ageGroups,
            datasets: datasets
        };

        if (ageFrequencyChart) ageFrequencyChart.destroy();
        ageFrequencyChart = new Chart(ageFrequencyChartCanvas, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                scales: {
                    x: { stacked: false }, // false = 그룹 막대, true = 누적 막대
                    y: { stacked: false, beginAtZero: true }
                },
                plugins: {
                    legend: { position: 'top' },
                    title: { display: false } // HTML에서 h3로 제목 표시
                }
            }
        });
    };
    // ▲▲▲ [신규] 세대별 독서 빈도 차트 ▲▲▲


    // 폼 제출 이벤트 처리 (이전과 동일)
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '제출 중...';

        const formData = new FormData(recordForm);
        const data = {
            nickname: formData.get('nickname'),
            age: formData.get('age'),
            frequency: formData.get('frequency'),
            purpose: formData.get('purpose'),
            genre: formData.get('genre'),
            format: formData.get('format'),
            bookTitle: formData.get('bookTitle'),
        };

        try {
            // 'no-cors' 모드는 POST 성공 여부를 정확히 알 수 없습니다.
            // 위 2단계에서 Code.gs를 수정했다면, mode를 삭제하고 CORS 응답을 받는 것이 더 좋습니다.
            // 하지만 기존 코드 유지를 위해 'no-cors'를 유지합니다.
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors', 
                cache: 'no-cache',
                redirect: 'follow',
                body: JSON.stringify(data)
            });

            alert('성공적으로 제출되었습니다! 감사합니다.');
            recordForm.reset();
            loadRecords(); // 데이터 다시 불러오기

        } catch (error) {
            console.error('Error submitting record:', error);
            alert('제출에 실패했습니다. 인터넷 연결을 확인하세요.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '나의 리포트 제출하기';
        }
    });

    // 엑셀 내보내기 이벤트 처리 (이전과 동일)
    exportButton.addEventListener('click', () => {
        if (recordsCache.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(recordsCache);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "리딩맵 응답");

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
        XLSX.writeFile(workbook, "reading_map_records.xlsx");
    });

    // 초기 데이터 로드
    loadRecords();
});