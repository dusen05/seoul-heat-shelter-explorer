// 1. 지도 생성
const map = L.map("map").setView([37.5665, 126.9780], 11);

// 쉼터 ID별 위치 정보 저장
let shelterLocations = {};

// 선택한 쉼터의 지도 마커
let selectedShelterMarker = null;

// 격자 레이어와 서울시 전체 지도 범위 저장
let gridLayer = null;
let fullMapBounds = null;

// 격자 탐색 모드
function setGridMode() {
    baseMap.setOpacity(0.25);

    if (gridLayer) {
        gridLayer.setStyle({
            fillOpacity: 0.90,
            opacity: 1
        });
    }
}

// 시설 상세 모드
function setShelterMode() {
    baseMap.setOpacity(1);

    if (gridLayer) {
        gridLayer.setStyle({
            fillOpacity: 0.2,
            opacity: 0.2
        });
    }
}

// 쉼터 GeoJSON 불러오기
fetch("data/shelters.geojson")
    .then(response => {
        if (!response.ok) {
            throw new Error("쉼터 위치 데이터를 불러오지 못했습니다.");
        }
        return response.json();
    })
    .then(data => {
        data.features.forEach(feature => {
            const id = String(feature.properties.web_id);

            shelterLocations[id] = {
                coordinates: feature.geometry.coordinates,
                properties: feature.properties
            };
        });

        console.log("쉼터 위치 데이터 로딩 완료:", data.features.length);
    })
    .catch(error => {
        console.error(error);
    });


// 배경지도
const baseMap = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
        opacity: 0.15
    }
).addTo(map);

// Gravity 접근성 범례
const legend = L.control({ position: "bottomright" });
legend.onAdd = function () {
    const div = L.DomUtil.create("div", "map-legend");

    div.innerHTML = `
        <div class="legend-title">무더위쉼터 접근성</div>

        <div class="legend-item">
            <span style="background:#eff3ff"></span>
            매우 낮음 (≤ 107.50)
        </div>

        <div class="legend-item">
            <span style="background:#bdd7e7"></span>
            낮음 (107.50–221.98)
        </div>

        <div class="legend-item">
            <span style="background:#6baed6"></span>
            보통 (221.98–389.39)
        </div>

        <div class="legend-item">
            <span style="background:#3182bd"></span>
            높음 (389.39–643.44)
        </div>

        <div class="legend-item">
            <span style="background:#08519c"></span>
            매우 높음 (> 643.44)
        </div>

        <div class="legend-item">
            <span style="background:#cccccc"></span>
            데이터 없음
        </div>

        <div class="legend-note">
            연한 파랑 → 진한 파랑: 접근성 낮음 → 높음
        </div>
    `;

    return div;
};


legend.addTo(map);

// 2. Gravity 값에 따른 색상
function getGravityColor(value) {
  if (value === null || value === undefined) return "#cccccc";

  if (value <= 107.50) return "#eff3ff"; // 매우 낮음
  if (value <= 221.98) return "#bdd7e7"; // 낮음
  if (value <= 389.39) return "#6baed6"; // 중간
  if (value <= 643.44) return "#3182bd"; // 높음

  return "#08519c";                    // 매우 높음
}

function getGravityLevel(value) {
    if (value === null || value === undefined) return "데이터 없음";

    if (value <= 107.50) return "매우 낮음";
    if (value <= 221.98) return "낮음";
    if (value <= 389.39) return "보통";
    if (value <= 643.44) return "높음";

    return "매우 높음";
}

// 선택한 쉼터를 지도에 표시
function showShelterOnMap(shelterId, walkMin, distanceM) {
    const shelter = shelterLocations[String(shelterId)];

    if (!shelter) {
        alert("쉼터 위치 정보를 찾을 수 없습니다.");
        return;
    }
    // 시설 상세 모드로 전환
    setShelterMode();

    // 전체 지도 복귀 버튼 표시
    document.getElementById("back-to-map").style.display = "block";

    // 기존 마커 제거
    if (selectedShelterMarker) {
        map.removeLayer(selectedShelterMarker);
    }

    // GeoJSON 좌표는 [경도, 위도] 순서
    const [lng, lat] = shelter.coordinates;

    selectedShelterMarker = L.marker([lat, lng]).addTo(map);


    const kakaoDirectionsUrl =
    `https://map.kakao.com/link/to/${encodeURIComponent(shelter.properties.name)},${lat},${lng}`;

    
    selectedShelterMarker.bindPopup(`
    <strong>${shelter.properties.name}</strong><br>
    격자 중심 기준 예상 보행시간: ${walkMin}분<br>
    보행거리: ${distanceM}m<br>
    수용인원: ${shelter.properties.capacity}명<br><br>

    <a href="${kakaoDirectionsUrl}"
       target="_blank"
       rel="noopener noreferrer"
       style="
           display:inline-block;
           padding:8px 12px;
           background:#FEE500;
           color:#222;
           text-decoration:none;
           border-radius:6px;
           font-weight:bold;
       ">
       내 위치에서 길찾기 ↗
    </a>
    `);

    map.setView([lat, lng], 17);
    selectedShelterMarker.openPopup();
}


// 3. 격자 정보 표시
function showGridInfo(properties) {
    const info = document.getElementById("grid-info");

    const gridId = properties.web_id;
    const access = accessibilityData[gridId];

    if (!access) {
        info.innerHTML = "<p>접근성 데이터를 불러오는 중입니다. 잠시 후 다시 선택해 주세요.</p>";
        return;
    }

    const facilities = access.facilities || [];

    const facilityHTML = facilities.length > 0
        ? facilities.map((facility, index) => `
            <div class="facility-item"
                data-shelter-id="${facility.shelter_id}"
                data-walk-min="${facility.walk_min}"
                data-distance-m="${facility.distance_m}">

                <div class="facility-name">
                    ${index + 1}. ${facility.name}
                </div>
                <div class="facility-detail">
                    격자 중심 기준 도보 ${facility.walk_min}분 ·
                    ${facility.distance_m}m ·
                    수용인원 ${facility.capacity}명
                    ${facility.capacity_imputed ? "(추정)" : ""}
                </div>
            </div>
        `).join("")
        : "<p>도보 15분 이내에 접근 가능한 쉼터가 없습니다.</p>";

    info.innerHTML = `

        <div class="info-item">
            <div class="info-label">Gravity 접근성 점수</div>

            <div class="gravity-row">
                <div
                    class="gravity-badge"
                    style="
                        background-color: ${getGravityColor(access.gravity)}33;
                        border-color: ${getGravityColor(access.gravity)};
                    "
                >
                    ${getGravityLevel(access.gravity)}
                </div>

                <div class="info-value">
                    ${Number(access.gravity).toFixed(1)}
                </div>
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">격자 인구</div>
            <div class="info-value">
                ${Number(access.population).toLocaleString()}명
            </div>
        </div>

        <div class="info-item">
            <div class="info-label">도보 15분 이내 쉼터</div>
            <div class="info-value">${facilities.length}개</div>
        </div>

        <h3>접근 가능한 무더위쉼터</h3>
        <div class="facility-list">
            ${facilityHTML}
        </div>

        <p class="data-note">
            * 도보 15분은 보행속도 4km/h를 가정한 격자 중심점 기준입니다.<br>
            * 수용인원 '(추정)'은 결측값을 중앙값으로 대체한 시설입니다.
        </p>
    `;

        // 쉼터 목록 클릭 이벤트
    info.querySelectorAll(".facility-item").forEach(item => {
        item.addEventListener("click", () => {
            const shelterId = item.dataset.shelterId;
            const walkMin = item.dataset.walkMin;
            const distanceM = item.dataset.distanceM;

            showShelterOnMap(shelterId, walkMin, distanceM);
        });
    });
}



// 격자별 접근 가능 쉼터 데이터
let accessibilityData = {};

// 접근성 JSON 불러오기
fetch("data/accessibility.json")
    .then(response => {
        if (!response.ok) {
            throw new Error("접근성 데이터를 불러오지 못했습니다.");
        }
        return response.json();
    })
    .then(data => {
        accessibilityData = data;
        console.log("접근성 데이터 로딩 완료");
    })
    .catch(error => {
        console.error(error);
    });

// 4. 격자 GeoJSON 불러오기
fetch("data/grid.geojson")
    .then(response => {
        if (!response.ok) {
            throw new Error("격자 데이터를 불러오지 못했습니다.");
        }
        return response.json();
    })
    .then(data => {
        gridLayer = L.geoJSON(data, {
            style: function(feature) {
                return {
                    fillColor: getGravityColor(feature.properties.gravity),
                    weight: 0.4,
                    color: "#ffffff",
                    fillOpacity: 0.85
                };
            },

            onEachFeature: function(feature, layer) {
                layer.on("click", function() {
                    if (gridLayer) {
                        gridLayer.resetStyle();
                    }

                    setGridMode();
                    showGridInfo(feature.properties);
                    gridLayer.resetStyle();

                    layer.setStyle({
                        weight: 2,
                        color: "#222222",
                        fillOpacity: 1
                    });

                    layer.bringToFront();
                });
            }
        }).addTo(map);

        fullMapBounds = gridLayer.getBounds();
        map.fitBounds(fullMapBounds);

        console.log("격자 로딩 완료:", data.features.length);
    })
    .catch(error => {
        console.error(error);
        document.getElementById("grid-info").textContent =
            "격자 데이터를 불러오지 못했습니다.";
    });



// 전체 지도 보기 버튼
document.getElementById("back-to-map").addEventListener("click", function() {

    // 격자 탐색 모드 복구
    setGridMode();

    // 시설 마커 제거
    if (selectedShelterMarker) {
        map.removeLayer(selectedShelterMarker);
        selectedShelterMarker = null;
    }

    // 서울시 전체 범위로 이동
    if (fullMapBounds) {
        map.fitBounds(fullMapBounds);
    }

    // 버튼 숨기기
    this.style.display = "none";
});