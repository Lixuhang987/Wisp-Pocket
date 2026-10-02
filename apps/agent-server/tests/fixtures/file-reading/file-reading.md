# 文件读取夹具

- `.gitattributes`：PDF 按二进制保存，避免文本换行转换或格式化破坏 xref 偏移。
- `encrypted.pdf`：pypdf 6.17.0 创建的单页 PDF，以测试密码 `fixture-password` 加密，验证解析器明确返回密码障碍。
- `over-page-limit.pdf`：同一生成器创建的 201 页空白 PDF，验证读取器先检查页数上限。

夹具不包含用户资料。普通文本 PDF 在用例中生成完整 xref，覆盖正文、无文字、损坏与正文上限；不能用文件名或伪造解析结果代替真实解析。
