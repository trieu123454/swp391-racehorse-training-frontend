import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root = process.cwd();
const out = path.join(root, 'outputs/vet-defense-20261120');
const vet = 'src/components/veterinarian/VeterinarianWorkspace.tsx';
const api = 'src/apis/veterinarian/api.ts';
const client = 'src/apis/client.ts';
const model = 'src/components/veterinarian/InjuryModel3D.tsx';
const route = 'src/page-components/RoleDashboardPage.tsx';
const source = new Map();
async function lines(file) { if (!source.has(file)) source.set(file, (await fs.readFile(path.join(root,file),'utf8')).split(/\r?\n/)); return source.get(file); }
async function locate(file, needle, count = 8) {
 const all = await lines(file); const i = all.findIndex(l=>l.includes(needle));
 if(i<0) throw new Error(`Missing evidence: ${file}: ${needle}`);
 return {ref:`${file}:${i+1}`, code:all.slice(i,i+count).join('\n')};
}
const wb = Workbook.create();
const specs=[];
function sheet(name,title,note,headers,rows,widths,codeCol=null){
 const s=wb.worksheets.add(name); const last=String.fromCharCode(64+headers.length); const end=rows.length+5;
 s.showGridLines=false;
 s.getRange(`A1:${last}${end}`).format.font={name:'Arial',size:11,color:'#243247'};
 s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:'#173754'};
 s.getRange('A3').values=[[note]];s.getRange('A3').format.font={name:'Arial',size:10,italic:true,color:'#526278'};
 s.getRange(`A5:${last}5`).values=[headers];s.getRange(`A6:${last}${end}`).values=rows;
 const header=s.getRange(`A5:${last}5`);header.format.fill='#173754';header.format.font={name:'Arial',size:11,color:'#FFFFFF',bold:true};header.format.horizontalAlignment='center';header.format.rowHeight=32;
 const body=s.getRange(`A6:${last}${end}`);body.format.wrapText=true;body.format.verticalAlignment='top';
 widths.forEach((w,i)=>s.getRange(`${String.fromCharCode(65+i)}5:${String.fromCharCode(65+i)}${end}`).format.columnWidth=w);
 for(let i=0;i<rows.length;i++){
  const r=i+6;if(i%2===1)s.getRange(`A${r}:${last}${r}`).format.fill='#F1F5F9';
  let h=36;
  rows[i].forEach((v,c)=>{const per=Math.max(12,Math.floor(widths[c]*.95));const n=String(v??'').split('\n').reduce((acc,l)=>acc+Math.max(1,Math.ceil(l.length/per)),0);h=Math.max(h,n*15+12)});
  s.getRange(`A${r}:${last}${r}`).format.rowHeight=Math.min(390,h);
 }
 if(codeCol!==null)s.getRange(`${String.fromCharCode(65+codeCol)}6:${String.fromCharCode(65+codeCol)}${end}`).format.font={name:'Consolas',size:10,color:'#243247'};
 s.freezePanes.freezeRows(5);
 const t=s.tables.add(`A5:${last}${end}`,true,'VetStudy'+(specs.length+1));t.showFilterButton=true;
 specs.push({name,end,last,rows:rows.length});return s;
}

const study=[
 ['01','Tổng quan','Trình bày nhiệm vụ của bác sĩ và trưởng ban trong 30–45 giây.','Đọc RoleDashboardPage, workspace-navigation và state trong VeterinarianWorkspace.'],
 ['02','Kiến trúc','Giải thích UI, handler, API wrapper, auth client và backend.','Theo một thao tác từ nút bấm đến request trong Network.'],
 ['03','Khám bệnh','Chọn ngựa, tải lịch sử, tạo/sửa phiếu, ghi chẩn đoán.','ExamHorsePicker, ExamHistoryViews và ExamsPanel.'],
 ['04','Chấn thương','Chọn vị trí 3D, tạo marker tạm, lưu, đồng bộ sức khỏe và khóa tập.','createInjury, updateStatus, buildInjuryCases.'],
 ['05','Phân quyền','Giải thích kiểm tra giao diện và kiểm tra API là hai trách nhiệm riêng.','submitMove chặn bác sĩ thường. Quyền backend cần kiểm chứng.'],
 ['06','Lịch chăm sóc','Đọc lịch tuần, chốt ca, dời ca, hoàn thành và điều phối.','CarePanel và các API periodic-care-schedules.'],
 ['07','Xác thực','Giải thích Bearer token, 401, refresh và retry.','authenticatedRequest và runWithAuthRetry.'],
 ['08','Mô hình 3D','Phân biệt GLB, lớp xương/cơ/nội tạng, Raycaster và dữ liệu marker.','InjuryModel3D cùng các builder và AnatomyPanel.'],
 ['09','Tình huống lỗi','Lưu thất bại, thành công một phần, dữ liệu đồng thời, phân trang.','Không khẳng định transaction hoặc bảo mật backend chỉ từ frontend.'],
 ['10','Luyện demo','Chọn ngựa, khám, chấn thương, kiểm tra khóa và mở khóa khi hồi phục.','Chỉ dùng dữ liệu thử đã chuẩn bị. Đọc câu hỏi tại sheet Phản biện.'],
];
sheet('Ôn tập','ÔN THUYẾT TRÌNH PHÂN HỆ THÚ Y','Mã nguồn được đọc ngày 20/11/2026. Dòng code có thể đổi sau khi chỉnh sửa.',['Thứ tự','Chủ đề','Cần trình bày được','Cách ôn'],study,[10,22,65,68]);

const flowDefs=[
 ['Đăng nhập và route',route,'validateSession(attempt > 0)','Xác thực phiên. Đối chiếu role của route với role người dùng. Render workspace theo vai trò.','Không coi redirect frontend là rào cản bảo mật cho API.'],
 ['Tổng quan',vet,'const loadOverview =','useEffect gọi loadOverview. Lấy overview, setOverview, giữ selectedId nếu còn tồn tại.','Mất kết nối: hiển thị lỗi, kết thúc loading.'],
 ['Chọn ngựa','src/components/veterinarian/ExamHorsePicker.tsx','export default function ExamHorsePicker','Tìm không dấu trên dữ liệu được truyền vào. onSelect(id) cập nhật ngựa tại component cha.','Component này không tự gọi API.'],
 ['Lịch sử khám','src/components/veterinarian/ExamHistoryViews.tsx','export default function ExamHistoryViews','Nhận phiếu khám, chẩn đoán theo phiếu và chấn thương. Sắp xếp thời gian. onOpen mở chi tiết.','Dữ liệu được tải bởi ExamsPanel ở component cha.'],
 ['Khám bệnh',vet,'async function save(data:','Đọc form. createExam hoặc updateExam. Có thể hoàn thành lịch chăm sóc liên kết.','Không coi lưu phiếu và hoàn thành lịch là một transaction frontend.'],
 ['Điều trị',vet,'function MedicalPanel','Tải hồ sơ/đơn thuốc. Tạo chẩn đoán và phác đồ. Kê, sửa, kết thúc hoặc dừng đơn.','Cảnh báo trùng thuốc không đồng nghĩa tự động chặn mọi trường hợp.'],
 ['Dinh dưỡng',vet,'function DietPanel','Tải khẩu phần. Tạo, chỉnh sửa hoặc kết thúc khẩu phần.','Phân biệt dữ liệu hiện hành với lịch sử.'],
 ['Tạo chấn thương',vet,'async function createInjury','Form và tọa độ. Thêm marker tạm. POST marker. Thay bằng bản ghi thật. Đồng bộ Injured/NotReady và khóa tập.','Lưu marker lỗi: bỏ marker tạm. Đồng bộ khóa lỗi: giữ ca đã lưu và báo lỗi.'],
 ['Tiến triển chấn thương',vet,'const allResolved = status === "Recovered"', 'Thêm mốc tiến triển bằng createInjury. Dựng timeline. Chỉ gọi mở khóa khi các ca đã hồi phục.','Trong tệp có hai updateStatus. Dẫn chứng chuyên sâu nằm ở sheet Dẫn chứng.'],
 ['Chuồng trại','src/components/veterinarian/StableWorkspace.tsx','export default function StableWorkspace','Lọc ngựa, đổi sơ đồ/danh sách. Sơ đồ chuyển sang HorseStableYard.','Dữ liệu ngựa và callback được truyền từ workspace.'],
 ['Ngựa trong chuồng','src/components/veterinarian/HorseStableYard.tsx','function StablePen','Nhóm ngựa theo chuồng. requestAnimationFrame cập nhật vị trí. Bấm ngựa mở thao tác y tế.','Horse.tsx vẽ SVG. Chuyển động vị trí thuộc HorseStableYard.'],
 ['Giải phẫu 3D',model,'current.placementMode && current.onSelectLocation','Tải GLB. Dựng các lớp giải phẫu. Raycaster tìm điểm. Callback đưa tọa độ về form.','Mô hình hỗ trợ chọn vị trí, không tự chẩn đoán.'],
 ['Lịch chăm sóc',vet,'function CarePanel','Tải schedules/calendar. Bác sĩ xem và thực hiện ca. Trưởng ban có điều phối và dời lịch.','Kèm lịch tập/đua mặc định tắt. Backend phải kiểm tra quyền và xung đột lịch.'],
 ['Sự cố',vet,'function StableIncidentsPanel','Tải sự cố. Tiếp nhận khẩn cấp chưa được giao hoặc xử lý sự cố được giao. Gửi kết quả.','Quyền nhận/xử lý và cạnh tranh tiếp nhận phải được kiểm soát ở backend.'],
 ['Cập nhật giao diện',vet,'const refreshAfterMutation','API client phát mutation event sau request thành công. Workspace tải lại tổng quan và việc cần làm sau debounce.','Đây là custom event trong trang, không phải WebSocket hay realtime giữa nhiều người dùng.'],
];
const flows=[];for(const [topic,file,needle,flow,limit] of flowDefs){const e=await locate(file,needle);flows.push([topic,flow,limit,e.ref]);}
sheet('Flow code','LUỒNG XỬ LÝ THEO CHỨC NĂNG','Đọc thao tác, hàm xử lý, API, cập nhật state và nhánh lỗi.',['Chức năng','Luồng code','Điểm cần nắm','Nguồn mã'],flows,[25,75,65,75]);

const apiText=(await lines(api)).join('\n');const start=apiText.indexOf('export const veterinarianApi = {');
const rest=apiText.slice(start);const matches=[...rest.matchAll(/^  (\w+)\([^\n]*\) \{/gm)];const apiRows=[];
for(let i=0;i<matches.length;i++){
 const m=matches[i];const block=rest.slice(m.index,i+1<matches.length?matches[i+1].index:rest.indexOf('\n};',m.index));
 const p=block.match(/([`"])(\/api\/[\s\S]*?)\1/);if(!p)throw new Error('API path missing '+m[1]);
 const method=block.match(/,\s*"(POST|PATCH|PUT|DELETE)"/);const e=await locate(api,'  '+m[1]+'(');
 const endpoint=m[1]==='overview' ? '/api/vet/health-overview (tùy chọn query section)' : p[2];
 apiRows.push([m[1],method?.[1]??'GET',endpoint,block.split('\n')[0].trim(),e.ref]);
}
sheet('API','DANH MỤC API THÚ Y','Trích từ veterinarianApi. Đường dẫn có biến là template trong code. Chưa xác minh implementation backend.',['Hàm frontend','Method','Endpoint','Tham số hàm','Nguồn mã'],apiRows,[25,11,80,85,46],3);

const evidenceDefs=[
 ['Vai trò',route,'<VeterinarianWorkspace isHeadVet=',1,'Dùng chung workspace. isHeadVet bật các thao tác riêng của trưởng ban.','Phân quyền API vẫn cần backend.'],
 ['Tải tổng quan',vet,'const result = await veterinarianApi.overview();',6,'Lưu dữ liệu server vào state. Giữ ngựa đang chọn khi còn tồn tại.','State không phải dữ liệu database.'],
 ['Gắn token',client,'export async function authenticatedRequest<T>',13,'Client tập trung gắn Authorization Bearer rồi gọi request.','Không chép token thật vào tài liệu hoặc log.'],
 ['Refresh và retry',client,'const result = await execute(accessToken);',21,'Request 401 đi qua refreshSession và thử lại. Lỗi khác 401 được ném tiếp.','Không retry mọi lỗi và không đồng nghĩa request ghi luôn idempotent.'],
 ['Tọa độ 3D',model,'const hit = raycaster.intersectObjects(modelMeshes, true)[0];',2,'Raycaster tìm điểm giao, chuyển tọa độ rồi phát callback.','Bấm vị trí chưa ghi vào database.'],
 ['Form nhận tọa độ',vet,'onSelectLocation={(coordinates, bodyPart)',9,'Callback cập nhật state nháp và bộ phận.','Chỉ cập nhật khi đang creating.'],
 ['Optimistic update',vet,'setMarkers((current) => [...current, draft]);',17,'Thêm marker tạm trước request. Khi thành công thì thay bằng bản ghi thật.','Thất bại thì xóa marker có tempId trong catch.'],
 ['Khóa tập sau chấn thương',vet,'const health = await veterinarianApi.updateHealthStatus(horse.id, "Injured", "NotReady", reason);',12,'Cập nhật sức khỏe rồi khóa nếu chưa bị khóa. Severe dùng Critical.','Ca đã lưu không bị xóa khi bước đồng bộ khóa lỗi.'],
 ['Điều kiện mở khóa',vet,'const allResolved = status === "Recovered"',20,'Kiểm tra ca hiện tại và các ca khác. Tất cả hồi phục thì gọi Healthy/Ready và unlock.','Dựa trên cases đã tải. Backend phải xét dữ liệu đầy đủ và các lý do khóa khác.'],
 ['Metadata chấn thương',vet,'function encodeInjuryNote(',3,'Trạng thái chi tiết và nhóm được mã hóa vào description.','Hướng cải thiện: trường riêng và mã ca riêng.'],
 ['Ghép ca',vet,'function buildInjuryCases(',15,'Sắp xếp marker rồi nhóm theo body_part được chuẩn hóa.','Hai chấn thương đồng thời cùng bộ phận có thể khó phân biệt.'],
 ['Chặn dời lịch',vet,'async function submitMove(',8,'Bác sĩ thường bị chặn ở handler, ngoài việc ẩn nút và form.','API dời lịch phải kiểm tra HEAD_VETERINARIAN ở server.'],
 ['Giải phóng 3D',model,'controls.dispose();',5,'Cleanup giải phóng controls và renderer khi component được dọn dẹp.','Cần giải phóng cả geometry/material/texture liên quan; xem phần cleanup đầy đủ.'],
];
const evid=[];for(const [topic,file,needle,n,meaning,limit] of evidenceDefs){const e=await locate(file,needle,n);evid.push([topic,e.code,meaning,limit,e.ref]);}
sheet('Dẫn chứng','DẪN CHỨNG CODE ĐỂ TRẢ LỜI','Đoạn trích nguyên văn từ mã nguồn. Các điểm chưa kiểm chứng backend được ghi riêng.',['Chủ đề','Code trích','Cách giải thích','Giới hạn / câu hỏi tiếp','Nguồn mã'],evid,[25,100,60,60,75],1);

const qa=[
 ['Kiến trúc','Bấm lưu đi qua các tầng nào?','Handler trong panel đọc/kiểm tra form. veterinarianApi chuyển dữ liệu sang JSON. authenticatedRequest gắn token và fetch. Sau đó cập nhật state hoặc xử lý lỗi.','Theo createInjury hoặc save của ExamsPanel.'],
 ['React','Vì sao dùng state?','State giữ dữ liệu thay đổi như selectedId, markers, loading và error. Khi cập nhật state, React render lại giao diện liên quan.','State không tự lưu database.'],
 ['React','useEffect, useMemo, useCallback khác nhau thế nào?','useEffect đồng bộ với bên ngoài và cleanup. useMemo ghi nhớ giá trị tính toán. useCallback giữ tham chiếu hàm theo dependency.','useMemo và useCallback không tự chạy request thay useEffect.'],
 ['TypeScript','Có generic T thì JSON server chắc chắn đúng chưa?','Chưa. TypeScript hỗ trợ kiểm tra kiểu lúc phát triển. Dữ liệu runtime vẫn cần kiểm tra cấu trúc và backend validate.','Không gọi ép kiểu là validation.'],
 ['Xác thực','401 khác 403 thế nào?','401 liên quan xác thực thiếu/hết hiệu lực. 403 là không đủ quyền dù đã xác thực. Client chỉ vào nhánh refresh sau lỗi 401 trong flow request.','HTTP response thực tế cần đối chiếu backend.'],
 ['Phân quyền','Ẩn nút dời lịch có bảo mật không?','Ẩn nút và chặn handler là kiểm soát UI. Backend phải kiểm tra role từ token trên API để chặn gọi trực tiếp.','Chưa xác minh security backend trong tài liệu này.'],
 ['Chấn thương','Chọn vị trí 3D có tự lưu không?','Không. Raycaster và callback chỉ cập nhật form nháp. Submit mới gọi POST injury-markers.','Không trình bày mô hình như công cụ tự chẩn đoán.'],
 ['Chấn thương','Lưu marker thất bại thì sao?','Marker tạm bị loại khỏi state, bỏ highlight và hiển thị lỗi.','Đây là rollback UI, không chứng minh rollback DB.'],
 ['Chấn thương','Marker lưu rồi nhưng khóa tập lỗi thì sao?','Giữ ca đã lưu. Catch riêng báo chưa đồng bộ được khóa. Không báo thao tác hoàn toàn thành công.','Hướng cải thiện: nghiệp vụ tập trung, transaction nếu cùng DB, và retry có kiểm soát.'],
 ['Chấn thương','Một ca hồi phục thì mở khóa ngay?','Không. Điều kiện allResolved yêu cầu ca hiện tại Recovered và tất cả ca khác cũng Recovered.','Backend cần kiểm tra lý do khóa khác và dữ liệu chưa tải.'],
 ['Dữ liệu','Cập nhật trạng thái dùng POST hay PATCH?','Hiện dùng POST thêm injury marker mới để lưu mốc lịch sử. buildInjuryCases tổng hợp thành timeline.','Không nói có bảng event-sourcing chuẩn khi chưa xem database.'],
 ['Dữ liệu','Vì sao metadata nằm trong description?','Đó là cơ chế hiện tại để lưu trạng thái chi tiết và nhóm cùng ghi chú. Có hàm mã hóa và tách metadata khi hiển thị.','Hạn chế: phụ thuộc chuỗi. Nên có trường riêng và injury_case_id.'],
 ['Dữ liệu','Hai chấn thương cùng bộ phận phân biệt thế nào?','Hiện nhóm theo body_part và tách đợt khi đã hồi phục rồi xuất hiện Active.','Chưa bảo đảm hai ca đồng thời cùng bộ phận. Nên có mã ca riêng.'],
 ['Đồng thời','Hai bác sĩ cập nhật cùng lúc thì sao?','Frontend hiện không chứng minh cơ chế xử lý cạnh tranh. Cần backend kiểm tra phiên bản hoặc locking và ràng buộc nghiệp vụ.','Không khẳng định đã có optimistic locking chỉ vì có optimistic update UI.'],
 ['API','Bấm lưu hai lần có tạo trùng không?','busy giúp hạn chế thao tác ở UI. Để bảo đảm ở server cần idempotency hoặc ràng buộc phù hợp.','Kiểm tra backend trước khi cam kết không trùng.'],
 ['API','GET, POST, PATCH khác nhau thế nào?','GET đọc dữ liệu. POST tạo bản ghi/thực hiện hành động. PATCH cập nhật một phần. PUT khóa tập là hợp đồng API hiện tại.','Giải thích theo ý nghĩa endpoint, không chỉ tên hàm.'],
 ['Lịch','Ai được dời lịch?','Trưởng ban. submitMove kiểm tra isHeadVet, UI cũng chỉ hiển thị thao tác tương ứng.','Quyền và xung đột thời gian phải được backend xác minh.'],
 ['Khám','Liên kết phiếu khám với lịch chăm sóc thế nào?','ExamsPanel nhận linkedScheduleId. Flow lưu có thể hoàn thành lịch liên kết sau khi lưu phiếu.','Nhiều request riêng có thể thành công một phần.'],
 ['3D','SVG chuồng khác mô hình chấn thương thế nào?','Horse.tsx vẽ ngựa 2D. HorseStableYard điều khiển vị trí và tương tác. InjuryModel3D dùng Three.js và GLB cho vị trí giải phẫu.','Không nhầm chuyển động CSS với render 3D.'],
 ['3D','Ba builder dùng làm gì?','Dựng lớp xương, cơ và nội tạng theo boneNodes và hệ trục. AnatomyPanel cung cấp UI lựa chọn/lọc.','Không khẳng định độ chính xác y khoa tuyệt đối.'],
 ['Hiệu năng','Vì sao cần dispose trong 3D?','Tài nguyên WebGL không được thu hồi đầy đủ chỉ bằng unmount React. Cleanup giải phóng renderer, controls và các tài nguyên đã tạo.','Kiểm tra quyền sở hữu tài nguyên khi dùng cache hoặc clone.'],
 ['Đồng bộ','Mutation event có phải realtime đa người dùng không?','Không. Đây là custom event trong cùng trang để tải lại dữ liệu sau mutation.','Realtime đa người dùng cần cơ chế như polling hoặc WebSocket và backend hỗ trợ.'],
 ['Phân trang','Danh sách ca hiện tại có đủ để mở khóa không?','API injuries dùng page=1, limit=100. Frontend xét cases đang có. Cần server kiểm tra toàn bộ dữ liệu liên quan.','Đừng nói kiểm tra frontend bao phủ toàn DB.'],
 ['Ngày giờ','Vì sao ngày marker có T12:00:00.000Z?','Code đang ghép ngày nhập với một giờ UTC cố định. Đây là lựa chọn lưu trữ hiện tại.','Chưa chứng minh giải quyết mọi timezone. Nên thống nhất date-only và instant với backend.'],
 ['Giới hạn','Chưa biết chi tiết backend thì trả lời thế nào?','Nêu rõ phần frontend em đã kiểm tra, request gửi đi và response dự kiến. Ràng buộc DB, transaction, quyền server cần đối chiếu mã backend.','Không đoán tên bảng, thuật toán hoặc cơ chế chưa thấy.'],
];
sheet('Phản biện','CÂU HỎI PHẢN BIỆN VÀ CÁCH TRẢ LỜI','Dùng để luyện nói. Khi cần chứng minh, mở sheet Dẫn chứng và tìm hàm tương ứng.',['Nhóm','Câu hỏi','Câu trả lời gợi ý','Điểm cần tránh / đào sâu'],qa,[22,52,95,72]);

wb.recalculate();
for(const spec of specs){
 const sample=await wb.inspect({kind:'table',range:`'${spec.name}'!A5:${spec.last}7`,include:'values',tableMaxRows:3,tableMaxCols:3,maxChars:900});
 console.log(spec.name+': '+spec.rows+' rows; '+sample.ndjson);
 const preview=await wb.render({sheetName:spec.name,range:`A2:${spec.last}8`,scale:1,format:'png'});
 await fs.writeFile(path.join(out,spec.name+'.png'),new Uint8Array(await preview.arrayBuffer()));
}
const output=await SpreadsheetFile.exportXlsx(wb);await output.save(path.join(out,'On-thuyet-trinh-Veterinarian.xlsx'));
console.log('EXPORTED '+path.join(out,'On-thuyet-trinh-Veterinarian.xlsx'));
