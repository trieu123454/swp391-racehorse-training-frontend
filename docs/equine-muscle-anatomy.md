# Lớp cơ giải phẫu ngựa

Viewer thú y dựng lớp cơ từ [muscles.json](../data/muscles.json) bằng [muscle-builder.ts](../components/veterinarian/muscle-builder.ts), sau đó hiển thị bộ lọc và phần tra cứu trong [MuscleAnatomyPanel.tsx](../components/veterinarian/MuscleAnatomyPanel.tsx). `InjuryModel3D.tsx` cung cấp rig xương, điều khiển camera và raycast.

## Dữ liệu và hình học

- Mỗi record khai báo tên Việt/Latin, nhóm, lớp nông/sâu, loại cấu trúc, nguyên ủy, bám tận, chức năng, hiệp đồng, đối kháng và ghi chú.
- `bone` chọn node trong rig GLB hoặc alias được ánh xạ trong `muscle-builder.ts`; `offset` là `[dọc, cao, ngang]` theo tỷ lệ kích thước mô hình. Điểm đầu/cuối vẫn gắn với bone node sau khi áp dụng offset.
- Cơ dùng `BufferGeometry` ống thuôn có tiết diện phình ở bụng cơ, phần nối gân màu ngà; cơ dạng phiến dùng tiết diện dẹt. Normal map thủ công tạo vân theo chiều dài sợi. Cân, gân và dây chằng có vật liệu riêng.
- Hầu hết cơ có hai mesh đối xứng. Cơ liên sườn được lặp qua các khoang sườn. Nhấp chọn để mở thông tin; di chuột để xem nhãn; nhấp đúp để đưa camera vào vùng cơ.
- Lọc theo Đầu–cổ, Thân mình, Chi trước, Chi sau, Gân & dây chằng; tìm theo tên; bật/tắt riêng lớp nông và sâu.
- Các bụng cơ chi trước kết thúc ở cổ tay; chi sau kết thúc ở vùng cổ chân. Phần xa chỉ chứa cấu trúc gân/dây chằng. Đây là quy tắc dựng của dữ liệu, không đại diện cho chuyển động giải phẫu.

## Tích hợp và thêm cấu trúc

Viewer hiện gọi `buildEquineMuscleLayer(boneNodes, axes)` sau khi tải và chuẩn hóa GLB. Để thêm một cơ, bổ sung record trong `data/muscles.json`, dùng `side: "bilateral"`, chọn node rig gần nhất cho hai điểm bám và ghi `note` nếu điểm đó không có node giải phẫu riêng. Các alias rig hiện có gồm sọ/cổ, cột sống, bả vai, cánh tay, cẳng tay, cổ tay, đùi, cẳng chân, cổ chân và các đốt ngón.

Độ lệch trong JSON là tỷ lệ dựng hình để đặt mesh lên rig hiện có, không phải số đo giải phẫu. Các mốc chưa được rig riêng như xương móng, xương ức, xương bả vai, củ gót, xương vừng, mỏm/chỏm xương và cân được đánh dấu ước lượng trong `note` hoặc trong nhãn nguyên ủy/bám tận. Không dùng các tọa độ này để lập kế hoạch điều trị.

## Các điểm cần chuyên gia kiểm chứng

1. Đối chiếu chính xác nguyên ủy/bám tận, lớp nông/sâu và hướng thớ của từng cơ đầu–cổ, thân, chi trước và chi sau trên tiêu bản hoặc atlas.
2. Kiểm tra riêng các cấu trúc không có bone node trong GLB: xương móng, xương ức, xương bả vai, xương vừng, củ gót, mỏm khuỷu, bánh chè, đường trắng và cân ngực–thắt lưng.
3. Xác nhận tên và phân chia các phần cơ ngực nông, cơ thang, cơ trám, cơ nhị đầu đùi, cơ tam đầu cánh tay và các cơ gấp/duỗi ngón theo danh pháp được chọn.
4. Kiểm tra đường đi, mặt nông/sâu, nhánh và điểm kết thúc của SDFT, DDFT, gân duỗi, dây chằng treo, dây chằng phụ, các dây chằng vừng và bộ máy tương hỗ.
5. Xác nhận vùng kết thúc của bụng cơ quanh cổ tay và cổ chân; tránh để mesh cơ đỏ đi xuống phần xa vốn được thể hiện bằng gân/dây chằng.
6. So vị trí mesh với xương ở mặt gần/mặt xa và ở góc nhìn trước/sau; kiểm tra giao cắt cơ-cơ, cơ-xương và độ bám khi thay đổi pose nếu rig được hoạt hóa sau này.
7. Đo chiều cao vai thực tế của GLB sau chuẩn hóa; viewer đang nhắm tỷ lệ ngựa trưởng thành khoảng 1,6 m ở vai, nhưng node vai và mặt đất của asset cần được xác nhận.
8. Kiểm tra màu, độ dày, texture thớ cơ, khả năng đọc khi zoom và hiệu năng trên laptop cấu hình trung bình.

## Tài liệu đối chiếu

- Dyce, Sack & Wensing, *Textbook of Veterinary Anatomy*, 5th ed., phần ngựa: đầu/cổ, lưng, ngực, bụng, chi trước và chi sau. [Elsevier](https://evolve.elsevier.com/cs/product/9780323442640?role=student)
- Budras et al., *Anatomy of the Horse*, 7th ed., atlas giải phẫu định khu và lâm sàng. [Schlütersche publisher](https://foreign-rights.schluetersche.de/de/veterinary-medicine/horses/anatomy-of-the-horse4%2C573268888.html)
- Danh sách và sơ đồ cơ nông ngựa: [University of Illinois College of Veterinary Medicine](https://vetmed.illinois.edu/open-house/wp-content/uploads/sites/126/2020/10/More-About-Horses-Illinois-Vet-Med-Open-House-2020.pdf)
- Gân gấp nông/sâu, dây chằng phụ và dây chằng treo ở chi xa: [University of Minnesota Large Animal Surgery notes](https://open.lib.umn.edu/largeanimalsurgery/chapter/tendon-anatomy/)
- Cấu tạo và điểm bám bộ máy dây chằng treo, xương vừng và dây chằng vừng xa: [UC Davis Center for Equine Health](https://ceh.vetmed.ucdavis.edu/sites/g/files/dgvnsk4536/files/local_resources/pdfs/Pubs-SuspBrochure-bkm-sec.pdf)
- Các nhóm cơ ngoại lai và cơ ngực nông: [University of Minnesota Ungulate Anatomy Lab Guide](https://pressbooks.umn.edu/ungulateanatomylabguide/chapter/part-2-extrinsic-muscles-and-associated-structures/)

Đây là lớp minh họa học tập. Trước khi dùng như atlas tham khảo chính thức, cần hoàn tất các mục kiểm chứng với Dyce/Budras và chuyên gia giải phẫu thú y.
