import SwiftUI

struct AgentTriggerSettingsView: View {
    @Bindable var viewModel: AgentTriggerSettingsViewModel
    @Environment(\.appTheme) private var theme
    @State private var isAdding = false
    @State private var selectedPackageId = "chrome-bookmarks"
    @State private var title = ""
    @State private var folderIds = ""
    @State private var scheduleAt = ""
    @State private var timezone = "Asia/Shanghai"

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                packagesSection
                SettingsSectionSeparator()
                instancesSection
                SettingsSectionSeparator()
                addButton
                if isAdding {
                    SettingsSectionSeparator()
                    createForm
                }
                if let error = viewModel.saveErrorMessage {
                    SettingsSection {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(theme.typography.captionFont)
                            .foregroundStyle(theme.colors.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
        .overlayScrollbar()
    }

    private var packagesSection: some View {
        Group {
            SettingsSectionHeader("已安装 Trigger")
            SettingsSection {
                if viewModel.installedPackages.isEmpty {
                    Text("当前没有安装的 AgentTrigger")
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(viewModel.installedPackages) { package in
                        HStack(alignment: .top, spacing: theme.spacing.md) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(package.title)
                                    .font(theme.typography.bodyFont.weight(.semibold))
                                    .foregroundStyle(theme.colors.ink)
                                Text(package.providerKind)
                                    .font(theme.typography.captionFont.monospaced())
                                    .foregroundStyle(theme.colors.textSecondary)
                                if !package.description.isEmpty {
                                    Text(package.description)
                                        .font(theme.typography.captionFont)
                                        .foregroundStyle(theme.colors.textSecondary)
                                }
                            }
                            Spacer()
                        }
                        if package.id != viewModel.installedPackages.last?.id {
                            SettingsRowDivider()
                        }
                    }
                }
            }
        }
    }

    private var instancesSection: some View {
        Group {
            SettingsSectionHeader("实例")
            SettingsSection {
                if viewModel.instances.isEmpty {
                    Text("当前没有 AgentTrigger 实例")
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(viewModel.instances) { instance in
                        HStack(alignment: .top, spacing: theme.spacing.md) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(instance.title)
                                    .font(theme.typography.bodyFont.weight(.semibold))
                                    .foregroundStyle(theme.colors.ink)
                                Text(instance.packageId)
                                    .font(theme.typography.captionFont.monospaced())
                                    .foregroundStyle(theme.colors.textSecondary)
                                Text(configSummary(instance))
                                    .font(theme.typography.captionFont)
                                    .foregroundStyle(theme.colors.textSecondary)
                            }
                            Spacer()
                        }
                        if instance.id != viewModel.instances.last?.id {
                            SettingsRowDivider()
                        }
                    }
                }
            }
        }
    }

    private var addButton: some View {
        SettingsSection {
            HStack {
                Button {
                    viewModel.installBuiltins()
                } label: {
                    Label("安装内置 Trigger", systemImage: "square.and.arrow.down")
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.colors.textSecondary)

                Spacer()

                Button {
                    isAdding.toggle()
                } label: {
                    Label(isAdding ? "收起" : "新增实例", systemImage: isAdding ? "chevron.up" : "plus")
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.colors.accent)
            }
        }
    }

    private var createForm: some View {
        VStack(spacing: 0) {
            SettingsSectionHeader("新增 AgentTrigger 实例")
            SettingsSection {
                SettingsRow("类型") {
                    Picker("", selection: $selectedPackageId) {
                        ForEach(viewModel.installedPackages) { package in
                            Text(package.title).tag(package.id)
                        }
                    }
                    .pickerStyle(.menu)
                }
                SettingsRowDivider()
                SettingsRow("标题") {
                    TextField("My Trigger", text: $title)
                        .textFieldStyle(SettingsFieldStyle())
                }
                if selectedPackageId == "chrome-bookmarks" {
                    SettingsRowDivider()
                    SettingsRow("Folders") {
                        TextField("folder-a,folder-b", text: $folderIds)
                            .textFieldStyle(SettingsFieldStyle())
                    }
                }
                if selectedPackageId == "system-clock" {
                    SettingsRowDivider()
                    SettingsRow("时间点") {
                        TextField("09:00,21:00", text: $scheduleAt)
                            .textFieldStyle(SettingsFieldStyle())
                    }
                    SettingsRowDivider()
                    SettingsRow("时区") {
                        TextField("Asia/Shanghai", text: $timezone)
                            .textFieldStyle(SettingsFieldStyle())
                    }
                }
                SettingsRowDivider()
                HStack {
                    Button("取消") {
                        resetForm()
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.colors.textSecondary)

                    Spacer()

                    Button("保存") {
                        let didCreate = viewModel.createInstance(
                            packageId: selectedPackageId,
                            title: title,
                            config: currentConfig()
                        )
                        if didCreate {
                            resetForm()
                        }
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.colors.accent)
                }
            }
        }
    }

    private func currentConfig() -> [String: AgentTriggerConfigValue] {
        switch selectedPackageId {
        case "chrome-bookmarks":
            let ids = folderIds
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            return ["folderIds": .stringList(ids)]
        case "system-clock":
            let schedule = scheduleAt
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            return [
                "scheduleAt": .stringList(schedule),
                "timezone": .string(timezone.trimmingCharacters(in: .whitespacesAndNewlines))
            ]
        default:
            return [:]
        }
    }

    private func configSummary(_ instance: AgentTriggerInstance) -> String {
        instance.config
            .sorted { $0.key < $1.key }
            .map { key, value in
                switch value {
                case .string(let raw):
                    return "\(key): \(raw)"
                case .stringList(let values):
                    return "\(key): \(values.joined(separator: ", "))"
                }
            }
            .joined(separator: " | ")
    }

    private func resetForm() {
        isAdding = false
        selectedPackageId = "chrome-bookmarks"
        title = ""
        folderIds = ""
        scheduleAt = ""
        timezone = "Asia/Shanghai"
    }
}
