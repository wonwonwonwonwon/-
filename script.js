document.addEventListener('DOMContentLoaded', () => {
    // !!! 중요: 배포된 자신의 Google Apps Script 웹 앱 URL
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyjcDLhXZSlBm2idpOjdlNec9CdsInGqcHOKVu_kwRuQ8fCWKr1PGG6dyfNZD7Xfdf8/exec'; // <--- 본인 URL 확인

    const recordForm = document.getElementById('record-form');
    const recordsContainer = document.getElementById('records-container');
    const exportButton = document.getElementById('export-excel');
    
    // 3개의 차트 캔버스
    const formatChartCanvas = document.getElementById('format-chart');
    const genreChartCanvas = document.getElementById('genre-chart');
    const ageFrequencyChartCanvas = document.getElementById('age-frequency-chart');
    
    let recordsCache = []; // 데이터 캐싱
    
    let formatChart;
    let genreChart;
    let ageFrequencyChart;

    // 데이터 로드 및 화면 업데이트
    const loadRecords = async () => {
        try {
            // ▼▼▼ Code.gs에 CORS 헤더가 적용되어 있어야 함 ▼▼▼
            const response = await fetch(WEB_APP_URL, { 
                method: 'GET',
                redirect: 'follow',
                headers: { 'Content-Type': 'application/json' }
             });
            // ▲▲▲ Code.gs에 CORS 헤더가 적용되어 있어야 함 ▲▲▲

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            recordsCache = await response.json();

            if (!Array.isArray(recordsCache)) {
                console.error("Error data received from Google Apps Script:", recordsCache);
                throw new Error('Google Apps Script에서 에러가 발생했습니다.');
            }
            
            recordsContainer.innerHTML = '<p>데이터를 불러오는 중...</p>';
            recordsCache.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
            
            recordsContainer.innerHTML = '';
            recordsCache.filter(r => r.bookTitle && r.bookTitle !== '없음').forEach(addRecordToDOM);
            
            // 3개의 차트 모두 렌더링
            renderFormatChart();
            renderGenreChart();
            renderAgeFrequencyChart();

        } catch (error) {
            console.error('Error loading records:', error);
            recordsContainer.innerHTML = `<p style="color: red;">데이터를 불러오는 데 실패했습니다: ${error.message}. Code.gs 배포를 확인하세요.</p>`;
        }
    };

    // DOM에 기록 목록 행 추가 (인생책 게시판용)
    const addRecordToDOM = (record) => {
        const row = document.createElement('div');
        row.classList.add('record-row');
        row.innerHTML = `
            <div class="record-nickname">${record.nickname || '-'}</div>
            <div class="record-book-title" title="${record.bookTitle}">${record.bookTitle || '-'}</div>
            <div class="record-book-reason" title="${record.bookReason}">${record.bookReason || '-'}</div>
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
                backgroundColor: ['#FFC107', '#FF7043', '#8BC34A', '#2196F3'],
                hoverOffset: 4
            }]
        };

        if (formatChart) formatChart.destroy();
        formatChart = new Chart(formatChartCanvas, {
            type: 'pie',
            data: chartData,
            options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: false } } }
        });
    };

    // 장르별 인기 비율 차트 (원형)
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
                    '#FFC107', '#FF7043', '#8BC34A', '#2196F3', '#9C27B0', 
                    '#00BCD4', '#FF5722', '#673AB7', '#E91E63', '#4CAF50',
                    '#FF9800', '#03A9F4', '#CDDC39', '#795548'
                ],
                hoverOffset: 4
            }]
        };

        if (genreChart) genreChart.destroy();
        genreChart = new Chart(genreChartCanvas, {
            type: 'pie',
            data: chartData,
            options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: false } } }
        });
    };

    // 세대별 독서 빈도 차트 (막대)
    const renderAgeFrequencyChart = () => {
        const ageGroups = ['10대', '20대', '30대', '40대 이상'];
        const frequencies = ['월 1회 미만', '월 1~2회', '월 3~4회', '주 1회 이상'];
        
        const dataByAge = recordsCache.reduce((acc, record) => {
            if (record.age && record.frequency) {
                if (!acc[record.age]) acc[record.age] = {};
                acc[record.age][record.frequency] = (acc[record.age][record.frequency] || 0) + 1;
            }
            return acc;
        }, {});

        const datasets = frequencies.map(freq => {
            return {
                label: freq,
                data: ageGroups.map(age => dataByAge[age]?.[freq] || 0),
            };
        });

        const colors = ['#2196F3', '#8BC34A', '#FFC107', '#FF7043'];
        datasets.forEach((ds, index) => {
            ds.backgroundColor = colors[index % colors.length];
        });

        const chartData = { labels: ageGroups, datasets: datasets };

        if (ageFrequencyChart) ageFrequencyChart.destroy();
        ageFrequencyChart = new Chart(ageFrequencyChartCanvas, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                scales: { x: { stacked: false }, y: { stacked: false, beginAtZero: true } },
                plugins: { legend: { position: 'top' }, title: { display: false } }
            }
        });
    };

    // 폼 제출 이벤트 처리 (CORS 수정본)
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // <-- 이것이 실행되어야 새로고침(초기화)이 안 됨
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
            bookReason: formData.get('bookReason')
        };

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                cache: 'no-cache',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.result === "success") {
                alert('성공적으로 제출되었습니다! 감사합니다.');
                recordForm.reset();
                loadRecords(); // 데이터 다시 불러오기
            } else {
                throw new Error(result.message || '알 수 없는 오류가 발생했습니다.');
            }

        } catch (error) {
            console.error('Error submitting record:', error);
            alert(`제출에 실패했습니다: ${error.message}`);
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
}); // <-- 이 마지막 부분이 누락되었을 가능성이 높습니다.