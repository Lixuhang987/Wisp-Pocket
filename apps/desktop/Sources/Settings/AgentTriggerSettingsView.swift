import SwiftUI

struct AgentTriggerSettingsView: View {
    @Bindable var viewModel: AgentTriggerSettingsViewModel
    @Environment(\.appTheme) private var theme

    var body: some View {
        SettingsPage {
            if let packageId = viewModel.selectedPackageId,
               let package = viewModel.installedPackages.first(where: { $0.id == packageId }) {
                PackageDetailView(viewModel: viewModel, package: package)
            } else {
                PackageListView(viewModel: viewModel)
            }
            if let error = viewModel.saveErrorMessage {
                SettingsErrorFooter(message: error)
            }
        }
        .overlayScrollbar()
    }
}

private struct PackageListView: View {
    @Bindable var viewModel: AgentTriggerSettingsViewModel
    @Environment(\.appTheme) private var theme

    var body: some View {
        if viewModel.installedPackages.isEmpty {
            SettingsEmptyState(title: "当前没有安装的 AgentTrigger", systemImage: "clock.badge.exclamationmark", reload: viewModel.reload)
        } else {
            SettingsSection {
                ForEach(viewModel.installedPackages) { package in
                    if package.id != viewModel.installedPackages.first?.id {
                        SettingsRowDivider()
                    }
                    Button {
                        viewModel.selectPackage(id: package.id)
                    } label: {
                        packageRow(package: package)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func packageRow(package: AgentTriggerPackageEntry) -> some View {
        let automationCount = viewModel.instances(forPackageId: package.id).count
        return HStack(alignment: .center, spacing: theme.spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text(package.title)
                    .font(theme.typography.bodyFont.weight(.semibold))
                    .foregroundStyle(theme.colors.ink)
                if !package.description.isEmpty {
                    Text(package.description)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textSecondary)
                }
            }
            Spacer(minLength: theme.spacing.md)
            HStack(spacing: theme.spacing.xs) {
                Text(automationCount == 0 ? "暂无自动化" : "\(automationCount) 个自动化")
                    .font(theme.typography.captionFont)
                    .foregroundStyle(theme.colors.textSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.colors.textSecondary)
            }
        }
        .contentShape(Rectangle())
    }
}

private struct PackageDetailView: View {
    @Bindable var viewModel: AgentTriggerSettingsViewModel
    let package: AgentTriggerPackageEntry
    @Environment(\.appTheme) private var theme
    @State private var isAdding = false
    @State private var title = ""
    @State private var folderIds = ""
    @State private var scheduleAt = ""
    @State private var timezone = "Asia/Shanghai"

    var body: some View {
        VStack(spacing: 0) {
            backRow
            packageHeader
            SettingsSectionSeparator()
            automationsSection
            SettingsSectionSeparator()
            addToggle
            if isAdding {
                SettingsSectionSeparator()
                createForm
            }
        }
        .onChange(of: viewModel.selectedPackageId) { _, _ in
            resetForm()
        }
    }

    private var backRow: some View {
        SettingsSection {
            SettingsActionButton(title: "返回", systemImage: "chevron.left", role: .secondary) {
                viewModel.clearSelection()
            }
        }
    }

    private var packageHeader: some View {
        SettingsSection {
            VStack(alignment: .leading, spacing: 4) {
                Text(package.title)
                    .font(theme.typography.titleFont.weight(.semibold))
                    .foregroundStyle(theme.colors.ink)
                if !package.description.isEmpty {
                    Text(package.description)
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var automationsSection: some View {
        Group {
            SettingsSectionHeader("自动化")
            let automations = viewModel.instances(forPackageId: package.id)
            if automations.isEmpty {
                SettingsEmptyState(title: "暂无自动化", systemImage: "clock.badge.exclamationmark", reload: nil)
            } else {
                SettingsSection {
                    ForEach(automations) { instance in
                        if instance.id != automations.first?.id {
                            SettingsRowDivider()
                        }
                        automationRow(instance)
                    }
                }
            }
        }
    }

    private func automationRow(_ instance: AgentTriggerInstance) -> some View {
        HStack(alignment: .top, spacing: theme.spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text(instance.title)
                    .font(theme.typography.bodyFont.weight(.semibold))
                    .foregroundStyle(theme.colors.ink)
                Text(configSummary(instance))
                    .font(theme.typography.captionFont)
                    .foregroundStyle(theme.colors.textSecondary)
            }
            Spacer()
            SettingsActionButton(title: "删除", systemImage: "trash", role: .destructive) {
                _ = viewModel.deleteInstance(id: instance.id)
            }
        }
        .padding(.vertical, theme.spacing.xs)
    }

    private var addToggle: some View {
        SettingsSection {
            HStack {
                Spacer()
                SettingsActionButton(
                    title: isAdding ? "收起" : "新增自动化",
                    systemImage: isAdding ? "chevron.up" : "plus",
                    role: .primary
                ) {
                    isAdding.toggle()
                    if !isAdding {
                        resetForm()
                    }
                }
            }
        }
    }

    private var createForm: some View {
        VStack(spacing: 0) {
            SettingsSectionHeader("新增自动化")
            SettingsSection {
                if hasFormFields {
                    SettingsRow("标题") {
                        SettingsTextField(placeholder: "My Automation", text: $title)
                    }
                    if package.providerKind == "chrome.bookmarks" {
                        SettingsRowDivider()
                        SettingsRow("Folders") {
                            SettingsTextField(placeholder: "folder-a,folder-b", text: $folderIds)
                        }
                    }
                    if package.providerKind == "system.clock" {
                        SettingsRowDivider()
                        SettingsRow("时间点") {
                            SettingsTextField(placeholder: "09:00,21:00", text: $scheduleAt)
                        }
                        SettingsRowDivider()
                        SettingsRow("时区") {
                            SettingsTextField(placeholder: "Asia/Shanghai", text: $timezone)
                        }
                    }
                    SettingsRowDivider()
                    SettingsFormActions {
                        SettingsActionButton(title: "取消", role: .secondary) {
                            isAdding = false
                            resetForm()
                        }
                    } trailing: {
                        SettingsActionButton(title: "保存", role: .primary) {
                            let didCreate = viewModel.createInstanceForCurrentPackage(
                                title: title,
                                config: currentConfig()
                            )
                            if didCreate {
                                isAdding = false
                                resetForm()
                            }
                        }
                    }
                } else {
                    Text("暂不支持自定义参数")
                        .font(theme.typography.captionFont)
                        .foregroundStyle(theme.colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var hasFormFields: Bool {
        package.providerKind == "chrome.bookmarks" || package.providerKind == "system.clock"
    }

    private func currentConfig() -> [String: AgentTriggerConfigValue] {
        switch package.providerKind {
        case "chrome.bookmarks":
            let ids = folderIds
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            return ["folderIds": .stringList(ids)]
        case "system.clock":
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
        title = ""
        folderIds = ""
        scheduleAt = ""
        timezone = "Asia/Shanghai"
    }
}
