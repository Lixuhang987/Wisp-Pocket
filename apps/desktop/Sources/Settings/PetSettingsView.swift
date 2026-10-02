import AppKit
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

struct PetSettingsView: View {
    @Bindable var viewModel: PetSettingsViewModel
    @Environment(\.appTheme) private var theme
    @State private var choosingImage = false
    @State private var choosingRoot = false

    var body: some View {
        SettingsPage {
            SettingsListSection(items: viewModel.pets) { pet in
                SettingsRow(pet.name) {
                    HStack {
                        PetImagePreview(reference: pet.imageRef)
                        VStack(alignment: .leading) {
                            Text(String(pet.id.prefix(8))).font(theme.typography.captionFont)
                            Text(pet.rootPath).lineLimit(1).truncationMode(.middle).help(pet.rootPath)
                            if pet.isDefault { Text("默认桌宠").foregroundStyle(theme.colors.accent) }
                        }
                        Spacer()
                        SettingsActionButton(title: "编辑", role: .secondary) { viewModel.beginEditing(pet) }
                        Menu("窗口") {
                            Button("显示") { viewModel.setVisible(pet, visible: true) }
                            Button("隐藏") { viewModel.setVisible(pet, visible: false) }
                        }
                        if !pet.isDefault {
                            SettingsActionButton(title: "设为默认", role: .secondary) { Task { await viewModel.makeDefault(pet) } }
                        }
                    }
                }
            }
            SettingsSection {
                SettingsActionButton(title: "添加桌宠", systemImage: "plus", role: .primary) { viewModel.beginCreating() }
                SettingsActionButton(title: "刷新", role: .secondary) { Task { await viewModel.reload() } }
                Text("共用目录会共享文件，不会共享对话历史。隐藏仅改变窗口显示。")
                    .font(theme.typography.captionFont).foregroundStyle(theme.colors.textSecondary)
            }
            if let message = viewModel.errorMessage { SettingsErrorFooter(message: message) }
        }
        .task { await viewModel.reload() }
        .sheet(isPresented: $viewModel.isEditing) { editor }
    }

    private var editor: some View {
        VStack(alignment: .leading, spacing: theme.spacing.md) {
            Text(viewModel.editingPet == nil ? "添加桌宠" : "编辑桌宠").font(theme.typography.titleFont)
            SettingsTextField(placeholder: "名称", text: $viewModel.name)
            SettingsTextField(placeholder: "工作方式描述（可选）", text: $viewModel.description)
            SettingsTextEditor(text: $viewModel.rolePrompt, placeholder: "角色提示词").frame(height: 100)
            Text("名字与图片立即更新；角色提示仅新对话使用，已有对话保留原设定。")
                .font(theme.typography.captionFont).foregroundStyle(theme.colors.textSecondary)
            HStack {
                PetImagePreview(reference: viewModel.imageRef)
                SettingsActionButton(title: "选择图片", role: .secondary) { choosingImage = true }
                SettingsActionButton(title: "内置八千代", role: .secondary) { viewModel.imageRef = .builtin }
            }
            if viewModel.editingPet == nil {
                SettingsTextField(placeholder: "文件根绝对路径", text: $viewModel.rootPath)
                SettingsActionButton(title: "选择目录", role: .secondary) { choosingRoot = true }
                if let message = viewModel.rootValidationMessage { Text(message).font(theme.typography.captionFont) }
            } else { Text("固定文件位置：\(viewModel.rootPath)").textSelection(.enabled) }
            Text("文件根创建后不可修改；读取可访问任意路径，内置写入限于此目录。")
                .font(theme.typography.captionFont).foregroundStyle(theme.colors.textSecondary)
            if let message = viewModel.errorMessage { SettingsErrorFooter(message: message) }
            SettingsFormActions {
                SettingsActionButton(title: "取消", role: .secondary) { viewModel.isEditing = false }
            } trailing: {
                SettingsActionButton(title: "保存", role: .primary) { Task { await viewModel.save() } }
                    .disabled(viewModel.isBusy)
            }
        }
        .padding(theme.spacing.xl).frame(width: 520).background(theme.colors.canvas)
        .fileImporter(isPresented: $choosingImage, allowedContentTypes: [.png, .jpeg, .webP]) { result in
            if case .success(let url) = result { Task { await viewModel.importImage(url) } }
        }
        .fileImporter(isPresented: $choosingRoot, allowedContentTypes: [.folder]) { result in
            if case .success(let url) = result { viewModel.rootPath = url.path }
        }
    }
}

private struct PetImagePreview: View {
    let reference: PetImageReference
    @Environment(\.appTheme) private var theme

    var body: some View {
        Group {
            if reference.type == "imported", let id = reference.blobId,
               let url = URL(string: "http://127.0.0.1:4317/api/blobs/\(id)") {
                AsyncImage(url: url) { phase in
                    if let image = phase.image { image.resizable().scaledToFit() }
                    else if phase.error != nil { Image(systemName: "photo.badge.exclamationmark").help("图片不可用") }
                    else { ProgressView() }
                }
            } else if let preview = Self.builtinPreview {
                Image(nsImage: preview).resizable().scaledToFit().help("内置八千代")
            } else {
                VStack { Image(systemName: "pawprint.fill"); Text("内置图不可用").font(theme.typography.captionFont) }
            }
        }
        .foregroundStyle(theme.colors.accent).frame(width: 56, height: 56)
        .accessibilityLabel("桌宠图片预览")
    }

    private static let builtinPreview: NSImage? = {
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { root.deleteLastPathComponent() }
        let candidates = [
            Bundle.main.resourceURL?.appendingPathComponent("yachiyo.webp"),
            root.appendingPathComponent("apps/electron-shell/src/activity-window/assets/yachiyo.webp")
        ].compactMap { $0 }
        for url in candidates {
            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                  let sprite = CGImageSourceCreateImageAtIndex(source, 0, nil),
                  let frame = sprite.cropping(to: CGRect(x: 0, y: 0, width: 192, height: 208)) else { continue }
            return NSImage(cgImage: frame, size: NSSize(width: 192, height: 208))
        }
        return nil
    }()

}
