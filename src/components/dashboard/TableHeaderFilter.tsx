import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Dropdown, Input, Button, Checkbox, Space, Menu, Tooltip } from 'antd';
import { SearchOutlined, FilterOutlined, CaretUpOutlined, CaretDownOutlined, ClearOutlined } from '@ant-design/icons';
import type { MenuProps, InputRef } from 'antd';

interface TableHeaderFilterProps {
  title: string;
  dataIndex: string;
  values: string[];
  onSort?: (direction: 'ascend' | 'descend' | null) => void;
  onFilter?: (selectedValues: string[]) => void;
  onSearch?: (searchText: string) => void;
  onClear?: () => void;
  totalRows?: number;
  allValues?: string[];
}

const TableHeaderFilter: React.FC<TableHeaderFilterProps> = ({
  title,
  dataIndex,
  values,
  onSort,
  onFilter,
  onSearch,
  onClear,
  totalRows,
  allValues
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [sortDirection, setSortDirection] = useState<'ascend' | 'descend' | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchInputRef = useRef<InputRef>(null);
  
  // 计算有效值的数量（过滤掉undefined值）
  const validValues = useMemo(() => {
    // 过滤掉undefined值
    return values.filter(v => v !== undefined);
  }, [values]);

  // 使用totalRows或values长度作为全选显示的总数
  const totalCount = totalRows || validValues.length;

  // 获取值的显示数量 - 优先使用allValues
  const getValueCount = (value: string) => {
    // 如果提供了allValues，则使用它来计算每个值的出现次数
    if (allValues && allValues.length > 0) {
      if (value === '' || value === null || value === undefined) {
        // 计算空值数量
        return allValues.filter(v => v === '' || v === null || v === undefined).length;
      }
      return allValues.filter(v => v === value).length;
    } else {
      // 如果没有提供allValues，则回退到原来的计算方式
      if (value === '' || value === null || value === undefined) {
        // 计算空值数量
        return validValues.filter(v => v === '' || v === null || v === undefined).length;
      }
      return validValues.filter(v => v === value).length;
    }
  };

  // 处理选择所有
  const handleSelectAll = () => {
    setSelectedValues(validValues);
    if (onFilter) {
      onFilter(validValues);
    }
  };

  // 处理反选
  const handleInvertSelection = () => {
    const invertedSelection = validValues.filter(value => !selectedValues.includes(value));
    setSelectedValues(invertedSelection);
    if (onFilter) {
      onFilter(invertedSelection);
    }
  };

  // 处理重复项筛选
  const handleShowDuplicates = () => {
    // 找出重复项
    const valueCounts = validValues.reduce((acc: Record<string, number>, curr) => {
      // 处理空值
      const key = curr === null || curr === undefined || curr === '' ? '(空白)' : curr;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    const duplicates = Object.entries(valueCounts)
      .filter(([_, count]) => count > 1)
      .map(([value]) => value === '(空白)' ? '' : value);
    
    setSelectedValues(duplicates);
    if (onFilter) {
      onFilter(duplicates);
    }
  };

  // 处理唯一项筛选
  const handleShowUnique = () => {
    // 找出唯一项
    const valueCounts = validValues.reduce((acc: Record<string, number>, curr) => {
      // 处理空值
      const key = curr === null || curr === undefined || curr === '' ? '(空白)' : curr;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    const uniques = Object.entries(valueCounts)
      .filter(([_, count]) => count === 1)
      .map(([value]) => value === '(空白)' ? '' : value);
    
    setSelectedValues(uniques);
    if (onFilter) {
      onFilter(uniques);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    if (onSearch) {
      onSearch(searchText);
    }
    
    // 基于搜索文本筛选
    const keywords = searchText.split(/[,\s]+/).filter(Boolean);
    if (keywords.length > 0) {
      const filtered = validValues.filter(value => 
        keywords.some(keyword => 
          value && value.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      setSelectedValues(filtered);
      if (onFilter) {
        onFilter(filtered);
      }
    }
  };

  // 处理清除筛选
  const handleClearFilter = () => {
    setSelectedValues([]);
    setSearchText('');
    setSortDirection(null);
    if (onClear) {
      onClear();
    }
    if (onFilter) {
      onFilter([]);
    }
    if (onSort) {
      onSort(null);
    }
  };

  // 处理排序
  const handleSort = (direction: 'ascend' | 'descend') => {
    setSortDirection(direction);
    if (onSort) {
      onSort(direction);
    }
  };

  // 处理选项勾选
  const handleCheckboxChange = (value: string, checked: boolean) => {
    const newSelection = checked 
      ? [...selectedValues, value]
      : selectedValues.filter(v => v !== value);
    
    setSelectedValues(newSelection);
    if (onFilter) {
      onFilter(newSelection);
    }
  };

  // 生成下拉菜单
  const dropdownMenu = (
    <Menu style={{ padding: '12px', width: '300px' }}>
      <div style={{ marginBottom: '12px' }}>
        <Input
          ref={searchInputRef}
          prefix={<SearchOutlined />}
          placeholder="搜索包含任一关键字，空格分隔"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onPressEnter={handleSearch}
          style={{ marginBottom: '8px' }}
          allowClear
        />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <Button
            type="primary"
            size="small"
            onClick={handleSearch}
          >
            搜索
          </Button>
          
          <Space>
            <Tooltip title="升序">
              <Button 
                size="small"
                type={sortDirection === 'ascend' ? "primary" : "default"}
                icon={<CaretUpOutlined />}
                onClick={() => handleSort('ascend')}
              />
            </Tooltip>
            <Tooltip title="降序">
              <Button 
                size="small"
                type={sortDirection === 'descend' ? "primary" : "default"}
                icon={<CaretDownOutlined />}
                onClick={() => handleSort('descend')}
              />
            </Tooltip>
          </Space>
        </div>
      </div>

      <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button size="small" onClick={handleSelectAll}>全选({totalCount})</Button>
        <Button size="small" onClick={handleInvertSelection}>反选</Button>
        <Button size="small" onClick={handleShowDuplicates}>重复项</Button>
        <Button size="small" onClick={handleShowUnique}>唯一项</Button>
      </div>

      <div style={{ maxHeight: '300px', overflow: 'auto', marginTop: '8px' }}>
        {validValues.map((value, index) => {
          // 获取此值的数量
          const count = getValueCount(value);
          return (
            <div key={`${value || '(空白)'}-${index}`} style={{ marginBottom: '4px' }}>
              <Checkbox
                checked={selectedValues.includes(value)}
                onChange={(e) => handleCheckboxChange(value, e.target.checked)}
              >
                {value || <span style={{ color: '#999', fontStyle: 'italic' }}>(空白)</span>}
                {` (${count})`}
              </Checkbox>
            </div>
          );
        })}
      </div>
    </Menu>
  );

  // 转换为菜单项
  const menuItems = [
    {
      key: 'search',
      label: <div style={{ marginBottom: '12px' }}>
        <Input
          ref={searchInputRef}
          prefix={<SearchOutlined />}
          placeholder="搜索包含任一关键字，空格分隔"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onPressEnter={handleSearch}
          style={{ marginBottom: '8px' }}
          allowClear
        />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <Button
            type="primary"
            size="small"
            onClick={handleSearch}
          >
            搜索
          </Button>
          
          <Space>
            <Tooltip title="升序">
              <Button 
                size="small"
                type={sortDirection === 'ascend' ? "primary" : "default"}
                icon={<CaretUpOutlined />}
                onClick={() => handleSort('ascend')}
              />
            </Tooltip>
            <Tooltip title="降序">
              <Button 
                size="small"
                type={sortDirection === 'descend' ? "primary" : "default"}
                icon={<CaretDownOutlined />}
                onClick={() => handleSort('descend')}
              />
            </Tooltip>
          </Space>
        </div>
      </div>
    },
    {
      key: 'actions',
      label: <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button size="small" onClick={handleSelectAll}>全选({totalCount})</Button>
        <Button size="small" onClick={handleInvertSelection}>反选</Button>
        <Button size="small" onClick={handleShowDuplicates}>重复项</Button>
        <Button size="small" onClick={handleShowUnique}>唯一项</Button>
      </div>
    },
    {
      key: 'values',
      label: <div style={{ maxHeight: '300px', overflow: 'auto', marginTop: '8px' }}>
        {validValues.map((value, index) => {
          // 获取此值的数量
          const count = getValueCount(value);
          return (
            <div key={`${value || '(空白)'}-${index}`} style={{ marginBottom: '4px' }}>
              <Checkbox
                checked={selectedValues.includes(value)}
                onChange={(e) => handleCheckboxChange(value, e.target.checked)}
              >
                {value || <span style={{ color: '#999', fontStyle: 'italic' }}>(空白)</span>}
                {` (${count})`}
              </Checkbox>
            </div>
          );
        })}
      </div>
    }
  ];

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      cursor: 'pointer', 
      justifyContent: 'center',
      width: '100%',
      textAlign: 'center'
    }}>
      <span>{title}</span>
      <Dropdown
        dropdownRender={() => dropdownMenu}
        trigger={['click']}
        onOpenChange={setIsDropdownOpen}
        open={isDropdownOpen}
      >
        <FilterOutlined 
          style={{ marginLeft: 5, color: selectedValues.length > 0 || sortDirection ? '#1890ff' : 'rgba(0, 0, 0, 0.45)' }} 
        />
      </Dropdown>
    </div>
  );
};

export default TableHeaderFilter; 