# Lớp nội tạng ngựa

Lớp nội tạng trong viewer được dựng bằng mesh ở [organ-builder.ts](../components/veterinarian/organ-builder.ts) và được điều khiển từ [InjuryModel3D.tsx](../components/veterinarian/InjuryModel3D.tsx). Các hình dạng là mesh hình học riêng phục vụ quan sát, không phải mesh giải phẫu quét hoặc atlas đã được chuyên gia xác nhận.

## Mesh và tương tác

- Phổi trái/phải dùng biên dạng nhiều thùy; tim, gan, dạ dày, thận và bàng quang dùng biên dạng đùn có độ dày. Ruột non, manh tràng, đại tràng, khí quản và các dây thần kinh lớn dùng đường ống cong có bán kính điều chỉnh.
- Cơ hoành là một mặt cong mỏng, bán trong suốt. Khí quản có vòng sụn đơn giản và hai nhánh phế quản chính.
- Mỗi mesh có một hệ cơ quan, mô tả chức năng, điểm neo để đặt nhãn và trạng thái ước lượng. Hover làm nổi cơ quan đang trỏ tới; click mở mô tả; double-click lấy nét camera.
- Bảng Nội tạng có công tắc Hô hấp, Tuần hoàn, Tiêu hóa, Tiết niệu, Thần kinh và nút bật/tắt nhãn. Tủy sống được dựng riêng trong nhóm thần kinh để có thể tắt độc lập.
- Camera tự fit theo bounding sphere của mô hình sau chuẩn hóa. Có preset bên trái, bên phải, trên và đặt lại góc. Mesh yên, dây cương, dây dắt và bờm được ẩn theo tên object/geometry.

## Giới hạn hình học

- Tọa độ được ước lượng theo rig hiện có; GLB không chứa mesh nội tạng hoặc mốc giải phẫu riêng. Điểm neo tương đối theo chiều dài, chiều cao, chiều ngang của mô hình.
- Số thùy phổi, đường đi ruột và các vòng đại tràng được giản lược để dễ nhìn; không dùng hình này để suy ra số đo, chẩn đoán hoặc lập kế hoạch điều trị.
- Đường thần kinh chỉ giữ tủy sống, thần kinh phế vị, đám rối cánh tay và thần kinh tọa. Độ dày/vị trí được phóng đại vừa đủ để thấy trên nền viewer.
- Ngựa không có túi mật; lớp này không tự thêm cơ quan không có trong danh sách.

## Các điểm cần chuyên gia kiểm chứng

1. Vị trí bờ phổi, tim, cơ hoành, gan và dạ dày với sườn, khuỷu và thành bụng ở các góc nhìn hai bên.
2. Hình dạng và tỷ lệ dạ dày so với ruột non, manh tràng và đại tràng lớn.
3. Vị trí đáy/đỉnh manh tràng, đường gấp đại tràng lớn, thận trái/phải và bàng quang trong vùng chậu.
4. Hướng đi và điểm chia nhánh của khí quản/phế quản; vị trí mặt phẳng cơ hoành.
5. Đường đi tủy sống trong ống sống và hướng các dây thần kinh lớn.
6. Độ trong suốt, độ chồng lấn, khả năng đọc nhãn và hiệu năng trên laptop tầm trung.

## Tài liệu tham khảo

- [University of Minnesota, Equine Abdomen Dissection Lab Guide](https://pressbooks.umn.edu/ungulateanatomylabguide/chapter/part-2-equine-abdomen/) – định khu nội tạng ngựa, hình dạng manh tràng và tương quan dạ dày/đại tràng.
- [University of Minnesota, CVM Large Animal Anatomy: Abdomen](https://pressbooks.umn.edu/largeanimalanatomy/chapter/abdomen-1/) – vị trí thận, bàng quang và phủ tạng quanh thành bụng.
- [Iowa State University Extension, Digestive Anatomy of the Horse](https://www.extension.iastate.edu/equine/synopsis-digestive-anatomy-and-physiology-horse) – các phần của ống tiêu hóa ngựa và lưu ý ngựa không có túi mật.
- [Dyce, Sack & Wensing, Textbook of Veterinary Anatomy](https://evolve.elsevier.com/cs/product/9780323442640?role=student) và [Budras et al., Anatomy of the Horse](https://foreign-rights.schluetersche.de/de/veterinary-medicine/horses/anatomy-of-the-horse4%2C573268888.html) – atlas cần dùng để đối chiếu chuyên môn trước khi xem lớp này như tài liệu giải phẫu chính thức.
