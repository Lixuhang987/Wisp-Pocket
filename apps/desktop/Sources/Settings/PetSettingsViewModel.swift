import Foundation

@Observable
@MainActor
final class PetSettingsViewModel {
    private(set) var pets: [PetEntry] = []
    private(set) var errorMessage: String?
    private(set) var isBusy = false
    var isEditing = false
    var name = ""
    var description = ""
    var rolePrompt = "请根据用户的明确要求提供帮助。"
    var rootPath = ""
    var imageRef = PetImageReference.builtin
    private(set) var editingPet: PetEntry?
    @ObservationIgnored private let client: (any PetManaging)?
    @ObservationIgnored private let visibility: (any ActivityWindowCommanding)?
    @ObservationIgnored private var visibilityCommands: Set<String> = []

    init(client: (any PetManaging)? = nil, visibility: (any ActivityWindowCommanding)? = nil) {
        self.client = client
        self.visibility = visibility
        visibility?.onActivityWindowCommandResult = { [weak self] result in
            guard let self, self.visibilityCommands.remove(result.commandId) != nil else { return }
            if !result.ok { self.errorMessage = result.error ?? "桌宠窗口操作失败" }
        }
    }

    func reload() async {
        guard let client else { errorMessage = "桌宠服务未连接"; return }
        do { pets = try await client.listPets(); errorMessage = nil }
        catch { errorMessage = error.localizedDescription }
    }

    func beginCreating() {
        editingPet = nil
        name = ""
        description = ""
        rolePrompt = "请根据用户的明确要求提供帮助。"
        rootPath = ""
        imageRef = .builtin
        errorMessage = nil
        isEditing = true
    }

    func beginEditing(_ pet: PetEntry) {
        editingPet = pet
        name = pet.name
        description = pet.description
        rolePrompt = pet.rolePrompt
        rootPath = pet.rootPath
        imageRef = pet.imageRef
        errorMessage = nil
        isEditing = true
    }

    var rootValidationMessage: String? {
        let path = rootPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard path.hasPrefix("/") else { return "请填写绝对目录路径；不存在的目录会在保存时创建。" }
        var isDirectory: ObjCBool = false
        if FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory), !isDirectory.boolValue {
            return "此路径是文件，请选择目录。"
        }
        return nil
    }

    func save() async {
        guard let client, !isBusy else { errorMessage = "桌宠服务未连接"; return }
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanRole = rolePrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty, !cleanRole.isEmpty else { errorMessage = "名称和角色提示不能为空"; return }
        if editingPet == nil, let message = rootValidationMessage { errorMessage = message; return }
        isBusy = true
        defer { isBusy = false }
        do {
            var fields: [String: Any] = ["name": cleanName, "description": description.trimmingCharacters(in: .whitespacesAndNewlines),
                                         "rolePrompt": cleanRole, "imageRef": try imageObject()]
            if let pet = editingPet {
                _ = try await client.petCommand("pet.update", payload: ["id": pet.id, "expectedRevision": pet.revision, "patch": fields])
            } else {
                fields["rootPath"] = rootPath.trimmingCharacters(in: .whitespacesAndNewlines)
                _ = try await client.petCommand("pet.create", payload: fields)
            }
            isEditing = false
            await reload()
        } catch { errorMessage = error.localizedDescription }
    }

    func importImage(_ url: URL) async {
        guard let client, !isBusy else { return }
        isBusy = true
        defer { isBusy = false }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let types = ["png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"]
            guard let mime = types[url.pathExtension.lowercased()] else { throw SwiftThreadClientError.startFailed("请选择 PNG、JPEG 或 WebP 静态图片") }
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size <= 20 * 1024 * 1024 else { throw SwiftThreadClientError.startFailed("图片不能超过 20 MiB") }
            let bytes = try Data(contentsOf: url)
            let payload = try await client.petCommand("pet.image.import", payload: ["mimeType": mime, "base64": bytes.base64EncodedString()])
            imageRef = try JSONDecoder().decode(PetImageReference.self, from: JSONSerialization.data(withJSONObject: payload["imageRef"] ?? [:]))
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }

    func makeDefault(_ pet: PetEntry) async {
        guard let client else { return }
        do {
            _ = try await client.petCommand("pet.update", payload: ["id": pet.id, "expectedRevision": pet.revision, "patch": ["isDefault": true]])
            await reload()
        } catch { errorMessage = error.localizedDescription }
    }

    func setVisible(_ pet: PetEntry, visible: Bool) {
        do {
            guard let visibility else { throw SwiftThreadClientError.startFailed("桌宠窗口服务未连接") }
            visibilityCommands.insert(try visibility.setPetVisible(petId: pet.id, visible: visible))
        } catch { errorMessage = error.localizedDescription }
    }

    private func imageObject() throws -> Any {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(imageRef))
    }
}
